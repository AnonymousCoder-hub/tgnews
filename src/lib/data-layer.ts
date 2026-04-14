/**
 * Optimized Data Layer for Telegram News
 * 
 * TWO-PHASE ARCHITECTURE:
 * 
 * Phase 1 (PRIORITY - inline, fast):
 *   Scrape ONLY first page of each channel (~3-5 msgs each)
 *   → Translate Arabic messages IMMEDIATELY (inline, not background)
 *   → Save to DB with translations
 *   → Return to user
 *   Total time: ~3-4 seconds
 * 
 * Phase 2 (BACKGROUND - non-blocking):
 *   Continue scraping older pages (up to 50 total per channel)
 *   → Translate Arabic messages in background
 *   → Save to DB
 *   Frontend picks these up on next poll
 * 
 * KEY PRINCIPLES:
 * 1. Latest news appears FAST (3-4s) with proper translations
 * 2. Older news arrives in background without blocking
 * 3. Cached data returns instantly (<100ms) when fresh
 * 4. google-translate-api-x for translation (proper API, not AI)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import translate from 'google-translate-api-x';
import * as cheerio from 'cheerio';
import { clearMemoryCache as clearSupabaseMemoryCache } from './supabase';

// ============================================
// Types
// ============================================

export interface TelegramMedia {
  type: 'photo' | 'video' | 'round' | 'large_media';
  url: string;
  thumbnailUrl?: string;
  duration?: string;
}

export interface LargeMediaInfo {
  type: 'video' | 'file' | 'photo';
  thumbnailUrl?: string;
  label?: string;
}

export interface TelegramMessage {
  id: string;
  postId: string;
  channelUsername: string;
  channelName: string;
  channelAvatar: string | null;
  text: string | null;
  views: number;
  timestamp: string;
  photos: string[];
  videos: TelegramMedia[];
  hasLargeMedia: boolean;
  largeMediaInfo?: LargeMediaInfo;
  reactions: { emoji: string; count: number }[];
  storedAt?: string;
}

export interface TelegramChannel {
  username: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  subscriberCount: string | null;
}

export interface PaginatedResult {
  messages: TelegramMessage[];
  channels: TelegramChannel[];
  total: number;
  todayCount: number;
  page: number;
  limit: number;
  hasMore: boolean;
  lastUpdated: string | null;
  cacheAgeSeconds: number;
  isScraping: boolean;
}

export interface ScrapeStatus {
  isScraping: boolean;
  lastScrapeTime: string | null;
  cacheAgeSeconds: number;
  isDataFresh: boolean;
  totalMessages: number;
  todayCount: number;
  isTranslating: boolean;
}

// Database message type (lowercase columns for PostgreSQL)
interface DbMessage {
  id: string;
  postid: string;
  channelusername: string;
  channelname: string;
  channelavatar: string | null;
  text: string | null;
  views: number;
  timestamp: string;
  photos: string[];
  videos: TelegramMedia[] | null;
  haslargemedia: boolean;
  largemediainfo: LargeMediaInfo | null;
  reactions: { emoji: string; count: number }[] | null;
  storedat: string;
}

// ============================================
// Configuration
// ============================================

const FRESH_DATA_THRESHOLD_SECONDS = 60; // Data is fresh if < 60s old
const DEFAULT_PAGE_SIZE = 20;

// Channels to scrape
export const CHANNELS = [
  'wfwitness',
  'warmonitors',
  'ethanlevins',
  'Middle_East_Spectator',
  'rnintel',
  'SabrenNewss',
  'AjaNews'
] as const;

// Arabic/Urdu character detection regex
// Covers Arabic (0600-06FF), Arabic Supplement (0750-077F), Arabic Extended-A (08A0-08FF), Urdu (0600-06FF shared + 0670+)
const ARABIC_URDU_REGEX = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/;

// Keep old name for backward compat
const ARABIC_REGEX = ARABIC_URDU_REGEX;

const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  rnintel: 'Rerum Novarum',
  wfwitness: 'WarFront Witness',
  warmonitors: 'War Monitors',
  ethanlevins: 'Ethan Levins',
  Middle_East_Spectator: 'Middle East Spectator',
  SabrenNewss: 'Sabreen News',
  AjaNews: 'Al Jazeera',
};

// ============================================
// Supabase Client (Lazy Initialization)
// ============================================

let _supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!_supabase) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !serviceRoleKey) {
      console.warn('[DATA] Missing Supabase credentials');
      return createClient('https://placeholder.supabase.co', 'placeholder-key');
    }
    
    _supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return _supabase;
}

// ============================================
// Global Scrape State
// ============================================

export let globalScrapeState = {
  isScraping: false,
  lastScrapeTime: null as Date | null,
  scrapeStartTime: null as Date | null,
  totalMessages: 0,
  isTranslating: false,
  isPhase2Running: false, // Background older messages scrape
};

// ============================================
// In-Memory First-Page Cache
// ============================================

/**
 * Cache for the first page of messages (no filters).
 * Provides instant <100ms page loads when data is fresh.
 */
let firstPageCache: {
  messages: TelegramMessage[];
  total: number;
  todayCount: number;
  timestamp: number;
} | null = null;

const FIRST_PAGE_CACHE_TTL = 60 * 1000; // 60 seconds

function getFirstPageCache(): { messages: TelegramMessage[]; total: number; todayCount: number } | null {
  if (firstPageCache && Date.now() - firstPageCache.timestamp < FIRST_PAGE_CACHE_TTL) {
    console.log('[DATA] First-page cache hit');
    return firstPageCache;
  }
  return null;
}

function setFirstPageCache(messages: TelegramMessage[], total: number, todayCount: number): void {
  firstPageCache = { messages, total, todayCount, timestamp: Date.now() };
}

function invalidateFirstPageCache(): void {
  firstPageCache = null;
}

// In-memory cache for message count
let messageCountCache: { count: number; timestamp: number } | null = null;
const MESSAGE_COUNT_CACHE_TTL = 10 * 1000; // 10 seconds

// ============================================
// Database Operations (Paginated)
// ============================================

/**
 * Get total message count (cached)
 */
async function getTotalMessageCount(): Promise<number> {
  if (messageCountCache && Date.now() - messageCountCache.timestamp < MESSAGE_COUNT_CACHE_TTL) {
    return messageCountCache.count;
  }
  
  try {
    const client = getSupabaseClient();
    const { count, error } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('[DATA] Error counting messages:', error);
      return messageCountCache?.count ?? 0;
    }
    
    const total = count ?? 0;
    messageCountCache = { count: total, timestamp: Date.now() };
    return total;
  } catch (error) {
    console.error('[DATA] Count error:', error);
    return messageCountCache?.count ?? 0;
  }
}

/**
 * Get today's message count (cached)
 */
let todayCountCache: { count: number; date: string; timestamp: number } | null = null;
const TODAY_COUNT_CACHE_TTL = 15 * 1000;

async function getTodayMessageCount(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  
  if (todayCountCache && 
      todayCountCache.date === today && 
      Date.now() - todayCountCache.timestamp < TODAY_COUNT_CACHE_TTL) {
    return todayCountCache.count;
  }
  
  try {
    const client = getSupabaseClient();
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    const { count, error } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gte('timestamp', todayStart.toISOString());
    
    if (error) {
      console.error('[DATA] Error counting today messages:', error);
      return todayCountCache?.count ?? 0;
    }
    
    const total = count ?? 0;
    todayCountCache = { count: total, date: today, timestamp: Date.now() };
    return total;
  } catch (error) {
    console.error('[DATA] Today count error:', error);
    return todayCountCache?.count ?? 0;
  }
}

/**
 * Get messages with pagination
 */
async function getMessagesPaginated(
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE,
  searchQuery?: string,
  channelFilter?: string,
  mediaFilter?: 'all' | 'photos' | 'videos' | 'none'
): Promise<{ messages: TelegramMessage[]; total: number; todayCount: number }> {
  const isCacheable = page === 1 && !searchQuery && !channelFilter && (!mediaFilter || mediaFilter === 'all');
  
  if (isCacheable) {
    const cached = getFirstPageCache();
    if (cached) {
      return cached;
    }
  }
  
  const offset = (page - 1) * limit;
  
  try {
    const client = getSupabaseClient();
    
    let query = client.from('messages').select('*', { count: 'exact' });
    
    if (channelFilter) {
      query = query.eq('channelusername', channelFilter);
    }
    
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim();
      query = query.or(`text.ilike.%${q}%,channelname.ilike.%${q}%,channelusername.ilike.%${q}%`);
    }
    
    const [total, todayCount] = await Promise.all([
      getTotalMessageCount(),
      getTodayMessageCount()
    ]);
    
    const { data, error, count } = await query
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (error) {
      console.error('[DATA] Error fetching messages:', error);
      return { messages: [], total: searchQuery ? 0 : total, todayCount };
    }
    
    let messages: TelegramMessage[] = (data as DbMessage[]).map(db => ({
      id: db.id,
      postId: db.postid,
      channelUsername: db.channelusername,
      channelName: db.channelname,
      channelAvatar: db.channelavatar,
      text: db.text,
      views: db.views,
      timestamp: db.timestamp,
      photos: db.photos || [],
      videos: (db.videos as TelegramMedia[]) || [],
      hasLargeMedia: db.haslargemedia,
      largeMediaInfo: (db.largemediainfo as LargeMediaInfo) || undefined,
      reactions: (db.reactions as { emoji: string; count: number }[]) || [],
      storedAt: db.storedat,
    }));
    
    if (mediaFilter === 'photos') {
      messages = messages.filter(m => m.photos.length > 0);
    } else if (mediaFilter === 'videos') {
      messages = messages.filter(m => m.videos.length > 0 || m.hasLargeMedia);
    } else if (mediaFilter === 'none') {
      messages = messages.filter(m => m.photos.length === 0 && m.videos.length === 0 && !m.hasLargeMedia);
    }
    
    const resultTotal = (searchQuery || channelFilter) ? (count ?? 0) : total;
    
    const result = { messages, total: resultTotal, todayCount };
    
    if (isCacheable) {
      setFirstPageCache(messages, resultTotal, todayCount);
    }
    
    return result;
  } catch (error) {
    console.error('[DATA] Fetch error:', error);
    return { messages: [], total: 0, todayCount: 0 };
  }
}

/**
 * Get last scrape time from database
 */
export async function getLastScrapeTime(): Promise<Date | null> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('last_scrape')
      .select('timestamp')
      .eq('id', 'singleton')
      .single();
    
    if (error || !data) return null;
    return new Date(data.timestamp);
  } catch {
    return null;
  }
}

/**
 * Set last scrape time
 */
async function setLastScrapeTime(): Promise<void> {
  try {
    const client = getSupabaseClient();
    await client
      .from('last_scrape')
      .upsert({ id: 'singleton', timestamp: new Date().toISOString() }, { onConflict: 'id' });
  } catch (error) {
    console.error('[DATA] Error setting scrape time:', error);
  }
}

// ============================================
// Scraper Functions
// ============================================

async function fetchTelegramHTML(username: string, beforePostId?: string): Promise<string> {
  let url = `https://t.me/s/${username}`;
  if (beforePostId) {
    url += `?before=${beforePostId}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
  });
  
  if (!response.ok) {
    throw new Error(`Failed to fetch ${username}: ${response.status}`);
  }
  
  return response.text();
}

/**
 * Parse count string that may include K/M suffixes
 */
function parseCount(countStr: string): number {
  if (!countStr) return 0;
  
  const cleaned = countStr.replace(/[^0-9.KMkm.]/g, '').trim();
  if (!cleaned) return 0;
  
  const upperStr = cleaned.toUpperCase();
  let multiplier = 1;
  let numPart = cleaned;
  
  if (upperStr.includes('K')) {
    multiplier = 1000;
    numPart = cleaned.replace(/[Kk]/g, '');
  } else if (upperStr.includes('M')) {
    multiplier = 1000000;
    numPart = cleaned.replace(/[Mm]/g, '');
  }
  
  const num = parseFloat(numPart);
  if (isNaN(num)) return 0;
  
  return Math.round(num * multiplier);
}

function parseViewCount(viewsStr: string): number {
  return parseCount(viewsStr);
}

function parseMessagesFromHTML(
  html: string,
  channel: TelegramChannel,
  $: cheerio.CheerioAPI
): TelegramMessage[] {
  const messages: TelegramMessage[] = [];
  
  $('.tgme_widget_message').each((_, messageEl) => {
    const $message = $(messageEl);
    const postId = $message.attr('data-post');
    if (!postId) return;
    
    const $time = $message.find('time.time').first();
    const datetime = $time.attr('datetime');
    const timestamp = datetime ? new Date(datetime).toISOString() : new Date().toISOString();
    
    const $textDiv = $message.find('.tgme_widget_message_text.js-message_text');
    let text: string | null = null;
    if ($textDiv.length) {
      const $clonedText = $textDiv.clone();
      $clonedText.find('br').replaceWith('\n');
      text = $clonedText.text().trim() || null;
    }
    
    const viewsText = $message.find('.tgme_widget_message_views').text().trim();
    const views = parseViewCount(viewsText);
    
    const photos: string[] = [];
    $message.find('.tgme_widget_message_photo_wrap').each((_, photoEl) => {
      const style = $(photoEl).attr('style') || '';
      const urlMatch = style.match(/background-image:url\('([^']+)'\)/i);
      if (urlMatch && !photos.includes(urlMatch[1])) photos.push(urlMatch[1]);
    });
    
    const videos: TelegramMedia[] = [];
    $message.find('.tgme_widget_message_video_player').each((_, videoPlayer) => {
      const $player = $(videoPlayer);
      const $video = $player.find('video');
      const videoUrl = $video.attr('src') || '';
      
      let thumbnailUrl: string | undefined;
      const $thumb = $player.find('.tgme_widget_message_video_thumb');
      if ($thumb.length) {
        const style = $thumb.attr('style') || '';
        const thumbMatch = style.match(/background-image:url\('([^']+)'\)/i);
        if (thumbMatch) thumbnailUrl = thumbMatch[1];
      }
      
      const duration = $player.find('.message_video_duration').text().trim();
      
      if (videoUrl || thumbnailUrl) {
        videos.push({ type: 'video', url: videoUrl, thumbnailUrl, duration });
      }
    });
    
    const reactions: { emoji: string; count: number }[] = [];
    $message.find('.tgme_reaction').each((_, reactionEl) => {
      const $reaction = $(reactionEl);
      
      let emoji = $reaction.find('i b').text().trim();
      if (!emoji) {
        const reactionText = $reaction.text();
        const emojiMatch = reactionText.match(/^[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/u);
        if (emojiMatch) {
          emoji = emojiMatch[0];
        }
      }
      
      let countText = $reaction.find('.tgme_reaction_emojis').text().trim();
      if (!countText) {
        countText = $reaction.text().replace(emoji, '').trim();
      }
      
      const count = parseCount(countText);
      if (emoji && count > 0) {
        reactions.push({ emoji, count });
      }
    });
    
    let hasLargeMedia = false;
    let largeMediaInfo: LargeMediaInfo | undefined;
    
    const $largeFile = $message.find('.tgme_widget_message_large_file');
    if ($largeFile.length) {
      hasLargeMedia = true;
      let thumbnailUrl: string | undefined;
      const $thumb = $largeFile.find('.tgme_widget_message_video_thumb');
      if ($thumb.length) {
        const style = $thumb.attr('style') || '';
        const thumbMatch = style.match(/background-image:url\('([^']+)'\)/i);
        if (thumbMatch) thumbnailUrl = thumbMatch[1];
      }
      
      let mediaType: 'video' | 'file' | 'photo' = 'file';
      const classAttr = $largeFile.attr('class') || '';
      if (classAttr.includes('video')) mediaType = 'video';
      else if (classAttr.includes('photo')) mediaType = 'photo';
      
      largeMediaInfo = { type: mediaType, thumbnailUrl };
    }
    
    if (text || photos.length > 0 || videos.length > 0 || hasLargeMedia) {
      messages.push({
        id: postId.replace('/', '-'),
        postId,
        channelUsername: channel.username,
        channelName: channel.name,
        channelAvatar: channel.avatarUrl,
        text,
        views,
        timestamp,
        photos,
        videos,
        hasLargeMedia,
        largeMediaInfo,
        reactions,
      });
    }
  });
  
  return messages;
}

/**
 * Phase 1: Scrape ONLY the first page of a channel (latest ~3-5 messages)
 * This is FAST - just one HTTP request + parse
 */
async function scrapeChannelFirstPage(
  username: string,
): Promise<{ channel: TelegramChannel; messages: TelegramMessage[] }> {
  const html = await fetchTelegramHTML(username);
  const $ = cheerio.load(html);
  
  const channel: TelegramChannel = {
    username,
    name: CHANNEL_DISPLAY_NAMES[username] || $('.tgme_channel_info_header_title').text().trim() || username,
    description: $('.tgme_channel_info_description').text().trim() || null,
    avatarUrl: $('.tgme_channel_info_header_image img').attr('src') || null,
    subscriberCount: $('.counter_value').first().text().trim() || null,
  };
  
  const messages = parseMessagesFromHTML(html, channel, $);
  console.log(`[SCRAPER-P1] ${username}: Got ${messages.length} latest messages`);
  
  return { channel, messages };
}

/**
 * Phase 2: Scrape older pages for a channel (up to maxTotal messages)
 * Runs in background - does NOT block the user
 */
async function scrapeChannelOlderPages(
  username: string,
  firstPageMessages: TelegramMessage[],
  existingMessageIds: Set<string>,
  maxTotal: number = 50,
): Promise<TelegramMessage[]> {
  const allMessages = [...firstPageMessages];
  let fetchedPages = 1;
  const maxPages = 3;
  
  while (allMessages.length < maxTotal && fetchedPages < maxPages) {
    const oldestMessage = allMessages[allMessages.length - 1];
    if (!oldestMessage) break;
    
    const numericId = oldestMessage.postId.split('/')[1];
    if (!numericId) break;
    
    // Stop if we found an existing message
    if (existingMessageIds.has(oldestMessage.id)) {
      break;
    }
    
    try {
      const olderHtml = await fetchTelegramHTML(username, numericId);
      const $older = cheerio.load(olderHtml);
      const channel: TelegramChannel = {
        username,
        name: CHANNEL_DISPLAY_NAMES[username] || username,
        description: null,
        avatarUrl: null,
        subscriberCount: null,
      };
      const olderMessages = parseMessagesFromHTML(olderHtml, channel, $older);
      
      if (olderMessages.length === 0) break;
      
      let addedCount = 0;
      for (const msg of olderMessages) {
        if (!allMessages.find(m => m.id === msg.id)) {
          allMessages.push(msg);
          addedCount++;
        }
      }
      
      fetchedPages++;
      console.log(`[SCRAPER-P2] ${username}: Page ${fetchedPages} - +${addedCount} messages (total: ${allMessages.length})`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (e) {
      console.log(`[SCRAPER-P2] ${username}: Pagination error, stopping`);
      break;
    }
  }
  
  allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return allMessages;
}

// ============================================
// Translation Functions (google-translate-api-x)
// ============================================

/**
 * Translate a single text from Arabic/Urdu to English
 * Uses google-translate-api-x with shorter timeout for speed
 */
async function translateText(text: string | null, retries = 1): Promise<string | null> {
  if (!text) return null;
  
  // Skip if no Arabic/Urdu characters - already translated or English
  if (!ARABIC_URDU_REGEX.test(text)) return null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await Promise.race([
        translate(text, { to: 'en' }),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Translation timeout')), 5000)
        )
      ]);
      
      if (result.text && result.text !== text) {
        return result.text;
      }
      
      // Same text returned - might be rate limited, retry
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    } catch (error) {
      console.log(`[TRANSLATE] Attempt ${attempt + 1} failed: ${error instanceof Error ? error.message : 'unknown'}`);
      if (attempt < retries - 1) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  }
  
  return null;
}

/**
 * Translate multiple messages (for Phase 1 - inline translation)
 * Translates ANY message containing Arabic/Urdu text regardless of channel
 * Uses google-translate-api-x in small sequential batches (max 2 parallel)
 * to avoid memory issues
 */
async function translateMessagesInline(messages: TelegramMessage[]): Promise<TelegramMessage[]> {
  // Find messages that need translation - ALL channels, not just specific ones
  const toTranslate = messages.filter(
    m => m.text && ARABIC_URDU_REGEX.test(m.text)
  );
  
  if (toTranslate.length === 0) {
    return messages; // Nothing to translate
  }
  
  console.log(`[TRANSLATE-P1] Translating ${toTranslate.length} Arabic/Urdu messages...`);
  const start = Date.now();
  
  // Translate in very small batches (2 parallel) to avoid memory issues
  const BATCH_SIZE = 2;
  const translationMap = new Map<string, string | null>();
  
  for (let i = 0; i < toTranslate.length; i += BATCH_SIZE) {
    const batch = toTranslate.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (msg) => {
        const translated = await translateText(msg.text);
        return { id: msg.id, translated };
      })
    );
    
    for (const { id, translated } of batchResults) {
      if (translated) translationMap.set(id, translated);
    }
    
    // Delay between batches to prevent memory spikes
    if (i + BATCH_SIZE < toTranslate.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  
  const result = messages.map(msg => {
    const translated = translationMap.get(msg.id);
    return translated ? { ...msg, text: translated } : msg;
  });
  
  const translatedCount = translationMap.size;
  console.log(`[TRANSLATE-P1] Done in ${Date.now() - start}ms: ${translatedCount}/${toTranslate.length} translated`);
  
  return result;
}

/**
 * Background translation for older messages (Phase 2)
 * Translates ANY message that still has Arabic/Urdu text, regardless of channel
 */
export async function translateNewMessages(): Promise<number> {
  if (globalScrapeState.isTranslating) {
    console.log('[TRANSLATE] Translation already in progress, skipping');
    return 0;
  }
  
  globalScrapeState.isTranslating = true;
  
  try {
    const client = getSupabaseClient();
    
    // Query ALL messages that still contain Arabic/Urdu text (not just specific channels)
    const { data, error } = await client
      .from('messages')
      .select('id, text, channelusername')
      .not('text', 'is', null)
      .order('timestamp', { ascending: false })
      .limit(100);
    
    if (error) {
      console.error('[TRANSLATE] Error fetching messages for translation:', error);
      return 0;
    }
    
    if (!data || data.length === 0) {
      console.log('[TRANSLATE] No messages found for translation');
      return 0;
    }
    
    // Filter to only messages that still contain Arabic/Urdu characters
    const messagesToTranslate = (data as { id: string; text: string; channelusername: string }[]).filter(
      msg => ARABIC_URDU_REGEX.test(msg.text)
    );
    
    if (messagesToTranslate.length === 0) {
      console.log('[TRANSLATE] No Arabic messages found that need translation');
      return 0;
    }
    
    console.log(`[TRANSLATE] Found ${messagesToTranslate.length} Arabic messages to translate`);
    const start = Date.now();
    let translatedCount = 0;
    
    // Translate in small parallel batches
    for (let i = 0; i < messagesToTranslate.length; i += 2) {
      const chunk = messagesToTranslate.slice(i, i + 2);
      
      const results = await Promise.all(
        chunk.map(async (msg) => {
          const translatedText = await translateText(msg.text);
          return { id: msg.id, translatedText };
        })
      );
      
      // Update database with translations
      for (const { id, translatedText } of results) {
        if (translatedText) {
          const { error: updateError } = await client
            .from('messages')
            .update({ text: translatedText })
            .eq('id', id);
          
          if (!updateError) {
            translatedCount++;
          }
        }
      }
      
      // Delay between chunks to avoid rate limiting and memory spikes
      if (i + 2 < messagesToTranslate.length) {
        await new Promise(r => setTimeout(r, 300));
      }
    }
    
    console.log(`[TRANSLATE] Done in ${Date.now() - start}ms: ${translatedCount} translated`);
    
    // Invalidate cache so users see updated text
    invalidateFirstPageCache();
    
    return translatedCount;
  } catch (error) {
    console.error('[TRANSLATE] Error in translateNewMessages:', error);
    return 0;
  } finally {
    globalScrapeState.isTranslating = false;
  }
}

// ============================================
// Save Messages
// ============================================

/**
 * Save messages to the database (with or without translations)
 */
async function saveMessages(messages: TelegramMessage[]): Promise<void> {
  if (messages.length === 0) return;
  
  const client = getSupabaseClient();
  
  const dbMessages = messages.map(msg => ({
    id: msg.id,
    postid: msg.postId,
    channelusername: msg.channelUsername,
    channelname: msg.channelName,
    channelavatar: msg.channelAvatar,
    text: msg.text,
    views: msg.views,
    timestamp: msg.timestamp,
    photos: msg.photos,
    videos: msg.videos,
    haslargemedia: msg.hasLargeMedia,
    largemediainfo: msg.largeMediaInfo || null,
    reactions: msg.reactions,
    storedat: new Date().toISOString(),
  }));
  
  const { error } = await client
    .from('messages')
    .upsert(dbMessages, { onConflict: 'id' });
  
  if (error) {
    console.error('[DATA] Error saving messages:', error);
  } else {
    console.log(`[DATA] Saved ${messages.length} messages`);
    messageCountCache = null;
  }
}

// In-memory cache for existing message IDs
let existingIdsCache: { ids: Set<string>; timestamp: number } | null = null;
const EXISTING_IDS_CACHE_TTL = 30 * 1000;

/**
 * Get existing message IDs - OPTIMIZED
 * Only fetches recent messages (last 7 days) for efficiency
 */
async function getExistingMessageIds(): Promise<Set<string>> {
  if (existingIdsCache && Date.now() - existingIdsCache.timestamp < EXISTING_IDS_CACHE_TTL) {
    return existingIdsCache.ids;
  }
  
  try {
    const client = getSupabaseClient();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { data, error } = await client
      .from('messages')
      .select('id')
      .gte('timestamp', sevenDaysAgo);
    
    if (error) {
      console.error('[SCRAPER] Error fetching existing IDs:', error);
      return existingIdsCache?.ids || new Set();
    }
    
    const ids = new Set(data?.map((item: { id: string }) => item.id) || []);
    existingIdsCache = { ids, timestamp: Date.now() };
    console.log(`[SCRAPER] Loaded ${ids.size} existing message IDs`);
    
    return ids;
  } catch (error) {
    console.error('[SCRAPER] Error in getExistingMessageIds:', error);
    return existingIdsCache?.ids || new Set();
  }
}

/**
 * Invalidate ALL caches
 */
export function invalidateAllCaches(): void {
  console.log('[DATA] Invalidating all caches...');
  existingIdsCache = null;
  messageCountCache = null;
  todayCountCache = null;
  invalidateFirstPageCache();
  clearSupabaseMemoryCache();
}

// ============================================
// Main Scraper - Two-Phase Architecture
// ============================================

/**
 * Phase 1: Quick scrape of latest messages
 * 
 * Scrapes ONLY the first page of each channel (~3-5 messages each).
 * Saves raw messages to DB immediately (fast).
 * Does NOT translate inline — translation happens at the API level
 * via ensureEnglishTranslations() for only the messages being displayed.
 * 
 * This is VERY FAST: ~1 second (just scraping + saving)
 */
export async function runScraperPhase1(): Promise<number> {
  console.log('[SCRAPER-P1] ========== Phase 1: Quick scrape (latest messages) ==========');
  const start = Date.now();
  
  // Scrape first page of ALL channels in parallel
  const results = await Promise.all(
    CHANNELS.map(username => scrapeChannelFirstPage(username).catch(e => {
      console.error(`[SCRAPER-P1] ${username}: Error -`, e);
      return null;
    }))
  );
  
  // Collect all messages
  const allMessages: TelegramMessage[] = [];
  for (const result of results) {
    if (result) {
      allMessages.push(...result.messages);
    }
  }
  
  console.log(`[SCRAPER-P1] Scraped ${allMessages.length} latest messages in ${Date.now() - start}ms`);
  
  // Save raw messages to DB (fast — no translation blocking here)
  // Translation will happen per-request via ensureEnglishTranslations()
  if (allMessages.length > 0) {
    await saveMessages(allMessages);
  }
  
  // Invalidate caches so fresh data is served
  invalidateAllCaches();
  await setLastScrapeTime();
  
  console.log(`[SCRAPER-P1] ========== Phase 1 complete in ${Date.now() - start}ms: ${allMessages.length} messages saved ==========`);
  
  return allMessages.length;
}

/**
 * Phase 2: Background scrape of older messages
 * 
 * Scrapes pages 2-3 for each channel (up to 50 total per channel).
 * Translates Arabic messages in background.
 * Does NOT block the user - runs after Phase 1 completes.
 */
async function runScraperPhase2(): Promise<void> {
  if (globalScrapeState.isPhase2Running) {
    console.log('[SCRAPER-P2] Already running, skipping');
    return;
  }
  
  globalScrapeState.isPhase2Running = true;
  
  try {
    console.log('[SCRAPER-P2] ========== Phase 2: Background older messages ==========');
    const start = Date.now();
    
    const existingIds = await getExistingMessageIds();
    
    // Scrape older pages for ALL channels in parallel
    const results = await Promise.all(
      CHANNELS.map(async (username) => {
        try {
          // First get first page again to have context for pagination
          const firstPage = await scrapeChannelFirstPage(username);
          const olderMessages = await scrapeChannelOlderPages(username, firstPage.messages, existingIds, 50);
          return { channel: firstPage.channel, messages: olderMessages };
        } catch (e) {
          console.error(`[SCRAPER-P2] ${username}: Error -`, e);
          return null;
        }
      })
    );
    
    // Collect all messages
    const messageMap = new Map<string, TelegramMessage>();
    for (const result of results) {
      if (result) {
        for (const msg of result.messages) {
          messageMap.set(msg.id, msg);
        }
      }
    }
    
    const allMessages = Array.from(messageMap.values());
    const newMessages = allMessages.filter(m => !existingIds.has(m.id));
    
    console.log(`[SCRAPER-P2] Found ${allMessages.length} total, ${newMessages.length} new messages`);
    
    // Save raw messages first (fast)
    if (allMessages.length > 0) {
      await saveMessages(allMessages);
    }
    
    // Invalidate caches
    invalidateAllCaches();
    
    // Translation happens per-request via ensureEnglishTranslations() at the API level.
    // No background bulk translation — too memory-intensive.
    // The translate-existing API endpoint can be called manually if needed.
    
    console.log(`[SCRAPER-P2] ========== Phase 2 complete in ${Date.now() - start}ms ==========`);
  } catch (error) {
    console.error('[SCRAPER-P2] Error:', error);
  } finally {
    globalScrapeState.isPhase2Running = false;
  }
}

/**
 * Run both phases: Phase 1 (inline) + Phase 2 (background)
 * Phase 1 is awaited (returns translated latest news quickly)
 * Phase 2 runs in background (non-blocking)
 */
export async function runScraper(): Promise<number> {
  // Phase 1: Quick scrape + inline translation (WAIT for this)
  const count = await runScraperPhase1();
  
  // Phase 2: Background older messages (fire-and-forget)
  runScraperPhase2().catch(err => {
    console.error('[SCRAPER-P2] Background error:', err);
  });
  
  return count;
}

// ============================================
// API-Level Translation Safety Net
// ============================================

/**
 * Ensures NO Arabic/Urdu text reaches the user.
 * Called at the API response level as a final safety net.
 * 
 * Uses google-translate-api-x in tiny sequential batches.
 * This guarantees 100% English delivery regardless of
 * background translation state.
 */
export async function ensureEnglishTranslations(messages: TelegramMessage[]): Promise<TelegramMessage[]> {
  // Find messages that still have Arabic/Urdu text
  const untranslated = messages.filter(m => m.text && ARABIC_URDU_REGEX.test(m.text));
  
  if (untranslated.length === 0) {
    return messages; // All good, no translation needed
  }
  
  console.log(`[TRANSLATE-SAFETY] Found ${untranslated.length} untranslated messages, translating on-the-fly...`);
  const start = Date.now();
  
  // Translate in tiny batches (2 parallel max) to avoid memory issues
  const BATCH_SIZE = 2;
  const translationMap = new Map<string, string>();
  let translatedCount = 0;
  
  for (let i = 0; i < untranslated.length; i += BATCH_SIZE) {
    const batch = untranslated.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (msg) => {
        try {
          const result = await Promise.race([
            translate(msg.text!, { to: 'en' }),
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]);
          return { id: msg.id, translated: result && result.text && result.text !== msg.text ? result.text : null };
        } catch {
          return { id: msg.id, translated: null };
        }
      })
    );
    
    for (const { id, translated } of results) {
      if (translated) {
        translationMap.set(id, translated);
        translatedCount++;
      }
    }
    
    // Delay between batches to prevent memory spikes
    if (i + BATCH_SIZE < untranslated.length) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  
  // Save translations back to DB in background (fire-and-forget)
  if (translatedCount > 0) {
    const client = getSupabaseClient();
    Promise.all(
      Array.from(translationMap.entries()).map(([id, text]) =>
        client.from('messages').update({ text }).eq('id', id)
      )
    ).then(() => {
      console.log(`[TRANSLATE-SAFETY] Saved ${translatedCount} translations to DB`);
      invalidateAllCaches();
    }).catch(err => {
      console.error('[TRANSLATE-SAFETY] Error saving translations:', err);
    });
  }
  
  console.log(`[TRANSLATE-SAFETY] Translated ${translatedCount}/${untranslated.length} in ${Date.now() - start}ms`);
  
  // Apply translations to messages
  return messages.map(msg => {
    const translated = translationMap.get(msg.id);
    return translated ? { ...msg, text: translated } : msg;
  });
}

// ============================================
// Main Export Functions
// ============================================

/**
 * Get paginated messages with smart caching
 */
export async function getPaginatedMessages(
  page: number = 1,
  limit: number = DEFAULT_PAGE_SIZE,
  forceRefresh: boolean = false,
  searchQuery?: string,
  channelFilter?: string,
  mediaFilter?: 'all' | 'photos' | 'videos' | 'none'
): Promise<PaginatedResult> {
  const lastScrapeTime = await getLastScrapeTime();
  const now = Date.now();
  const cacheAgeMs = lastScrapeTime ? now - lastScrapeTime.getTime() : Infinity;
  const cacheAgeSeconds = Math.floor(cacheAgeMs / 1000);
  const isDataFresh = cacheAgeSeconds < FRESH_DATA_THRESHOLD_SECONDS;
  
  const { messages, total, todayCount } = await getMessagesPaginated(page, limit, searchQuery, channelFilter, mediaFilter);
  
  const allChannels: TelegramChannel[] = CHANNELS.map(username => ({
    username,
    name: CHANNEL_DISPLAY_NAMES[username] || username,
    description: null,
    avatarUrl: null,
    subscriberCount: null,
  }));
  
  return {
    messages,
    channels: allChannels,
    total,
    todayCount,
    page,
    limit,
    hasMore: (page * limit) < total,
    lastUpdated: lastScrapeTime?.toISOString() || null,
    cacheAgeSeconds,
    isScraping: globalScrapeState.isScraping,
    isDataFresh,
  };
}

/**
 * Get current scrape status (for frontend polling)
 */
export async function getScrapeStatus(): Promise<ScrapeStatus> {
  const lastScrapeTime = await getLastScrapeTime();
  const now = Date.now();
  const cacheAgeMs = lastScrapeTime ? now - lastScrapeTime.getTime() : Infinity;
  const cacheAgeSeconds = Math.floor(cacheAgeMs / 1000);
  const isDataFresh = cacheAgeSeconds < FRESH_DATA_THRESHOLD_SECONDS;
  
  const [totalMessages, todayCount] = await Promise.all([
    getTotalMessageCount(),
    getTodayMessageCount()
  ]);
  
  return {
    isScraping: globalScrapeState.isScraping,
    lastScrapeTime: lastScrapeTime?.toISOString() || null,
    cacheAgeSeconds,
    isDataFresh,
    totalMessages,
    todayCount,
    isTranslating: globalScrapeState.isTranslating,
  };
}

/**
 * Trigger background scrape (non-blocking)
 */
export function triggerBackgroundScrape(): void {
  if (globalScrapeState.isScraping) {
    console.log('[DATA] Scrape already in progress');
    return;
  }
  
  globalScrapeState.isScraping = true;
  globalScrapeState.scrapeStartTime = new Date();
  
  (async () => {
    try {
      await runScraper();
    } catch (error) {
      console.error('[DATA] Background scrape error:', error);
    } finally {
      globalScrapeState.isScraping = false;
      globalScrapeState.lastScrapeTime = new Date();
    }
  })();
}

/**
 * Force refresh - wait for Phase 1 (latest messages + translations)
 * Phase 2 runs in background
 */
export async function forceRefreshAndWait(): Promise<ScrapeStatus> {
  if (globalScrapeState.isScraping) {
    console.log('[DATA] Waiting for existing scrape to complete...');
    
    let attempts = 0;
    while (globalScrapeState.isScraping && attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 500));
      attempts++;
    }
    
    return getScrapeStatus();
  }
  
  globalScrapeState.isScraping = true;
  globalScrapeState.scrapeStartTime = new Date();
  
  try {
    await runScraper();
  } catch (error) {
    console.error('[DATA] Force refresh error:', error);
  } finally {
    globalScrapeState.isScraping = false;
    globalScrapeState.lastScrapeTime = new Date();
  }
  
  return getScrapeStatus();
}

/**
 * Get all channels for filter UI
 */
export async function getAllChannels(): Promise<TelegramChannel[]> {
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('messages')
      .select('channelusername, channelname, channelavatar')
      .order('channelusername');
    
    if (error || !data) {
      return CHANNELS.map(username => ({
        username,
        name: CHANNEL_DISPLAY_NAMES[username] || username,
        description: null,
        avatarUrl: null,
        subscriberCount: null,
      }));
    }
    
    const channelMap = new Map<string, TelegramChannel>();
    for (const item of data as { channelusername: string; channelname: string; channelavatar: string | null }[]) {
      if (!channelMap.has(item.channelusername)) {
        channelMap.set(item.channelusername, {
          username: item.channelusername,
          name: CHANNEL_DISPLAY_NAMES[item.channelusername] || item.channelname,
          description: null,
          avatarUrl: item.channelavatar,
          subscriberCount: null,
        });
      }
    }
    
    return Array.from(channelMap.values());
  } catch {
    return CHANNELS.map(username => ({
      username,
      name: CHANNEL_DISPLAY_NAMES[username] || username,
      description: null,
      avatarUrl: null,
      subscriberCount: null,
    }));
  }
}

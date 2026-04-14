import * as cheerio from 'cheerio';
import { 
  getAllMessages, 
  saveMessages, 
  getLastScrapeTime, 
  setLastScrapeTime,
  clearMemoryCache,
  getBlacklistedIds,
  DbMessage 
} from './supabase';

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
  twitterLink?: string | null;
}

export interface TelegramChannel {
  username: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  subscriberCount: string | null;
}

// Channels to aggregate - MUST match data-layer.ts
export const CHANNELS = [
  'wfwitness',
  'warmonitors',
  'ethanlevins',
  'Middle_East_Spectator',
  'rnintel',
  'SabrenNewss',
  'AjaNews'
] as const;

// Display names for channels (override scraped names)
const CHANNEL_DISPLAY_NAMES: Record<string, string> = {
  rnintel: 'Rerum Novarum',
  wfwitness: 'WarFront Witness',
  warmonitors: 'War Monitors',
  ethanlevins: 'Ethan Levins',
  Middle_East_Spectator: 'Middle East Spectator',
  SabrenNewss: 'Sabreen News',
  AjaNews: 'Al Jazeera',
};

// Lock to prevent concurrent scrapes
let isScrapingInProgress = false;
let scrapingPromise: Promise<unknown> | null = null;

// Fetch HTML from Telegram preview page
async function fetchTelegramHTML(username: string, beforePostId?: string): Promise<string> {
  let url = `https://t.me/s/${username}`;
  if (beforePostId) {
    url += `?before=${beforePostId}`;
  }
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Cache-Control': 'no-cache',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${username}: ${response.status}`);
  }

  return response.text();
}

/**
 * Parse count string that may include K/M suffixes
 * Examples: "1.4K" -> 1400, "2M" -> 2000000, "140" -> 140
 */
function parseCount(countStr: string): number {
  if (!countStr) return 0;
  
  // Remove any non-numeric characters except dots, K, M
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

// Check if enough time has passed since last scrape
function shouldScrape(lastScrapeTime: Date | null, minIntervalSeconds = 60): boolean {
  if (!lastScrapeTime) return true;
  const now = Date.now();
  const lastScrape = lastScrapeTime.getTime();
  return (now - lastScrape) >= (minIntervalSeconds * 1000);
}

// Trigger background scrape (non-blocking)
let backgroundScrapePromise: Promise<void> | null = null;

async function triggerBackgroundScrape(): Promise<void> {
  // Don't start if already scraping
  if (isScrapingInProgress) return;

  isScrapingInProgress = true;
  backgroundScrapePromise = (async () => {
    try {
      console.log('[SUPABASE] Background scrape started...');
      await fetchAndMergeData();
      console.log('[SUPABASE] Background scrape completed!');
    } catch (error) {
      console.error('[SUPABASE] Background scrape error:', error);
    } finally {
      isScrapingInProgress = false;
      backgroundScrapePromise = null;
    }
  })();

  // Don't await - let it run in background
}

// Convert TelegramMessage to DbMessage format (lowercase column names for PostgreSQL)
function toDbMessage(msg: TelegramMessage): DbMessage {
  return {
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
    storedat: msg.storedAt || new Date().toISOString(),
    updatedat: new Date().toISOString(),
    twitterlink: msg.twitterLink || null,
  };
}

// Convert DbMessage to TelegramMessage format (camelCase for our app)
function fromDbMessage(db: DbMessage): TelegramMessage {
  return {
    id: db.id,
    postId: db.postid,
    channelUsername: db.channelusername,
    channelName: db.channelname,
    channelAvatar: db.channelavatar,
    text: db.text,
    views: db.views,
    timestamp: db.timestamp,
    photos: db.photos,
    videos: (db.videos as TelegramMedia[]) || [],
    hasLargeMedia: db.haslargemedia,
    largeMediaInfo: (db.largemediainfo as LargeMediaInfo) || undefined,
    reactions: (db.reactions as { emoji: string; count: number }[]) || [],
    storedAt: db.storedat,
    twitterLink: db.twitterlink,
  };
}

// Parse messages from HTML
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

    // Get reply text
    let replyText: string | null = null;
    const $replyDiv = $message.find('.tgme_widget_message_reply');
    if ($replyDiv.length) {
      const $replyTextDiv = $replyDiv.find('.tgme_widget_message_text');
      if ($replyTextDiv.length) {
        $replyTextDiv.find('br').replaceWith('\n');
        replyText = $replyTextDiv.text().trim() || null;
      }
    }

    // Get text with proper spacing
    const $textDiv = $message.find('.tgme_widget_message_text.js-message_text');
    let text: string | null = null;
    if ($textDiv.length) {
      const $clonedText = $textDiv.clone();
      $clonedText.find('br').replaceWith('\n');
      $clonedText.find('blockquote, p, div').each((_, el) => {
        const $el = $(el);
        const content = $el.text().trim();
        if (content) {
          $el.replaceWith('\n' + content + '\n');
        } else {
          $el.remove();
        }
      });
      text = $clonedText.text().trim();
      text = text.replace(/\n{3,}/g, '\n\n');
      if (!text) text = null;
    }

    // Combine reply and main text
    let finalText = text;
    if (replyText && text) {
      finalText = `↩️ ${replyText}\n\n${text}`;
    } else if (replyText) {
      finalText = `↩️ ${replyText}`;
    }

    // Check for Twitter links
    let twitterLink: string | null = null;
    if (finalText) {
      const twitterMatch = finalText.match(/https?:\/\/(?:twitter\.com|x\.com)\/[^\s]+/i);
      if (twitterMatch) twitterLink = twitterMatch[0];
    }

    // Get views
    const viewsText = $message.find('.tgme_widget_message_views').text().trim();
    const views = parseViewCount(viewsText);

    // Get photos
    const photos: string[] = [];
    $message.find('.tgme_widget_message_photo_wrap').each((_, photoEl) => {
      const style = $(photoEl).attr('style') || '';
      const urlMatch = style.match(/background-image:url\('([^']+)'\)/i);
      if (urlMatch && !photos.includes(urlMatch[1])) photos.push(urlMatch[1]);
    });

    // Get videos
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
        videos.push({
          type: 'video',
          url: videoUrl,
          thumbnailUrl,
          duration: duration || undefined
        });
      }
    });

    // Get reactions - improved parsing to handle K/M suffixes
    const reactions: { emoji: string; count: number }[] = [];
    $message.find('.tgme_reaction').each((_, reactionEl) => {
      const $reaction = $(reactionEl);
      
      // Try multiple ways to get the emoji
      let emoji = $reaction.find('i b').text().trim();
      if (!emoji) {
        // Fallback: try to get emoji from the reaction element directly
        const reactionText = $reaction.text();
        // Match emoji at the start of the text
        const emojiMatch = reactionText.match(/^[\p{Emoji_Presentation}\p{Emoji}\uFE0F]/u);
        if (emojiMatch) {
          emoji = emojiMatch[0];
        }
      }
      
      // Get count - try the emojified element first, then the text
      let countText = $reaction.find('.tgme_reaction_emojis').text().trim();
      if (!countText) {
        // Fallback: get all text and remove emoji
        countText = $reaction.text().replace(emoji, '').trim();
      }
      
      const count = parseCount(countText);
      if (emoji && count > 0) {
        reactions.push({ emoji, count });
      }
    });

    // Check for large media
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
      
      if (!thumbnailUrl) {
        const $img = $largeFile.find('img');
        if ($img.length) thumbnailUrl = $img.attr('src') || undefined;
      }
      
      if (!thumbnailUrl) {
        const $previewImg = $message.find('.tgme_widget_message_photo_wrap, .tgme_widget_message_video_thumb');
        $previewImg.each((_, el) => {
          if (!thumbnailUrl) {
            const style = $(el).attr('style') || '';
            const match = style.match(/background-image:url\('([^']+)'\)/i);
            if (match) thumbnailUrl = match[1];
          }
        });
      }
      
      let mediaType: 'video' | 'file' | 'photo' = 'file';
      const classAttr = $largeFile.attr('class') || '';
      if (classAttr.includes('video')) mediaType = 'video';
      else if (classAttr.includes('photo')) mediaType = 'photo';
      
      largeMediaInfo = { type: mediaType, thumbnailUrl, label: $largeFile.text().trim() || undefined };
    }
    
    const fileTooBigText = $message.find('.tgme_widget_message_text').text();
    if (fileTooBigText.toLowerCase().includes('file is too big') || 
        fileTooBigText.toLowerCase().includes('video is too big')) {
      hasLargeMedia = true;
      if (!largeMediaInfo) largeMediaInfo = { type: 'video' };
    }

    if (finalText || photos.length > 0 || videos.length > 0 || hasLargeMedia) {
      messages.push({
        id: postId.replace('/', '-'),
        postId,
        channelUsername: channel.username,
        channelName: channel.name,
        channelAvatar: channel.avatarUrl,
        text: finalText,
        views,
        timestamp,
        photos,
        videos,
        hasLargeMedia,
        largeMediaInfo,
        reactions,
        twitterLink
      });
    }
  });

  return messages;
}

// Scrape a single channel - fetches up to maxMessages per channel
export async function scrapeChannel(
  username: string, 
  existingMessageIds: Set<string> = new Set(),
  maxMessages: number = 50
): Promise<{
  channel: TelegramChannel;
  messages: TelegramMessage[];
}> {
  // Fetch initial page
  const html = await fetchTelegramHTML(username);
  const $ = cheerio.load(html);
  
  // Parse channel info
  const channel: TelegramChannel = {
    username,
    name: CHANNEL_DISPLAY_NAMES[username] || $('.tgme_channel_info_header_title').text().trim() || username,
    description: $('.tgme_channel_info_description').text().trim() || null,
    avatarUrl: $('.tgme_channel_info_header_image img').attr('src') || null,
    subscriberCount: null
  };
  
  const subText = $('.counter_value').first().text().trim();
  if (subText) channel.subscriberCount = subText;

  // Parse initial messages
  let allMessages: TelegramMessage[] = parseMessagesFromHTML(html, channel, $);
  
  // Fetch more pages if needed
  let fetchedPages = 1;
  const maxPages = 5; // Limit to avoid too many requests
  
  while (allMessages.length < maxMessages && fetchedPages < maxPages) {
    // Get the oldest message ID to use as 'before' parameter
    const oldestMessage = allMessages[allMessages.length - 1];
    if (!oldestMessage) break;
    
    // Extract just the numeric ID part (e.g., "wfwitness/78460" -> "78460")
    const numericId = oldestMessage.postId.split('/')[1];
    if (!numericId) break;
    
    // Check if we already have this message
    if (existingMessageIds.has(oldestMessage.id)) {
      console.log(`[SCRAPER] ${username}: Found existing message ${oldestMessage.id}, stopping pagination`);
      break;
    }
    
    // Fetch older messages
    console.log(`[SCRAPER] ${username}: Fetching page ${fetchedPages + 1} (before ${numericId})`);
    
    try {
      const olderHtml = await fetchTelegramHTML(username, numericId);
      const $older = cheerio.load(olderHtml);
      const olderMessages = parseMessagesFromHTML(olderHtml, channel, $older);
      
      if (olderMessages.length === 0) break;
      
      // Check if oldest of new batch exists
      const oldestNew = olderMessages[olderMessages.length - 1];
      if (oldestNew && existingMessageIds.has(oldestNew.id)) {
        // Add messages up to but not including existing ones
        for (const msg of olderMessages) {
          if (!existingMessageIds.has(msg.id) && !allMessages.find(m => m.id === msg.id)) {
            allMessages.push(msg);
          }
        }
        break;
      }
      
      // Add unique messages
      for (const msg of olderMessages) {
        if (!allMessages.find(m => m.id === msg.id)) {
          allMessages.push(msg);
        }
      }
      
      fetchedPages++;
      
      // Small delay to be nice to Telegram
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (e) {
      console.log(`[SCRAPER] ${username}: Error fetching older messages:`, e);
      break;
    }
  }
  
  // Sort by timestamp (newest first)
  allMessages.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  console.log(`[SCRAPER] ${username}: Fetched ${allMessages.length} messages from ${fetchedPages} page(s)`);
  
  return { channel, messages: allMessages };
}

// Merge old and new messages (deduplicate by ID, keep latest version)
function mergeMessages(
  oldMessages: TelegramMessage[], 
  newMessages: TelegramMessage[]
): TelegramMessage[] {
  const messageMap = new Map<string, TelegramMessage>();
  
  // Add old messages first
  for (const msg of oldMessages) {
    if (msg && msg.id) {
      messageMap.set(msg.id, msg);
    }
  }
  
  // Add/update with new messages (they have latest views/reactions)
  const now = new Date().toISOString();
  for (const msg of newMessages) {
    if (msg && msg.id) {
      messageMap.set(msg.id, { ...msg, storedAt: now });
    }
  }
  
  // Convert to array and sort by timestamp (newest first)
  const result = Array.from(messageMap.values());
  result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  
  return result;
}

// Get all channels with proper caching
// Behavior (OPTIMIZED FOR SPEED):
// - ALWAYS return cached data immediately if available (even if stale)
// - If data is stale, trigger background scrape (don't wait)
// - Only wait for scrape if there's NO data at all (first visit)
// - Manual refresh triggers immediate scrape
export async function getAllChannels(forceRefresh = false): Promise<{
  channels: TelegramChannel[];
  messages: TelegramMessage[];
  lastUpdated: string | null;
  isCached: boolean;
  cacheAge: number | null;
  isScrapingInBackground?: boolean;
}> {
  const MIN_SCRAPE_INTERVAL = 60; // 60 seconds - data is "fresh" if younger than this

  // Get from database first (always)
  const dbMessages = await getAllMessages();
  const lastScrapeTime = await getLastScrapeTime();
  const cacheAge = lastScrapeTime
    ? Math.floor((Date.now() - lastScrapeTime.getTime()) / 1000)
    : null;

  const isDataFresh = lastScrapeTime && !shouldScrape(lastScrapeTime, MIN_SCRAPE_INTERVAL);
  const needsScrape = forceRefresh || shouldScrape(lastScrapeTime, MIN_SCRAPE_INTERVAL);

  // Helper to build response from cached messages
  const buildResponse = (messages: TelegramMessage[], isCached: boolean, isScrapingInBackground = false) => {
    const channelMap = new Map<string, TelegramChannel>();
    for (const msg of messages) {
      if (!channelMap.has(msg.channelUsername)) {
        channelMap.set(msg.channelUsername, {
          username: msg.channelUsername,
          name: CHANNEL_DISPLAY_NAMES[msg.channelUsername] || msg.channelName,
          description: null,
          avatarUrl: msg.channelAvatar,
          subscriberCount: null
        });
      }
    }
    return {
      channels: Array.from(channelMap.values()),
      messages,
      lastUpdated: lastScrapeTime?.toISOString() || null,
      isCached,
      cacheAge,
      isScrapingInBackground
    };
  };

  // If we have cached data, return it immediately
  if (dbMessages.length > 0) {
    const messages = dbMessages.map(fromDbMessage);

    // Data is fresh - no need to scrape
    if (!forceRefresh && isDataFresh) {
      console.log(`[SUPABASE] Data is fresh (${cacheAge}s old) - returning cache`);
      return buildResponse(messages, true, false);
    }

    // Data is stale or force refresh - return cache BUT trigger background scrape
    if (needsScrape && !isScrapingInProgress) {
      console.log(`[SUPABASE] Data is stale (${cacheAge}s old) - returning cache, scraping in background...`);
      // Start background scrape (don't await)
      triggerBackgroundScrape();
      return buildResponse(messages, true, true);
    }

    // Scrape already in progress - just return cache
    if (isScrapingInProgress) {
      console.log(`[SUPABASE] Scrape already in progress - returning cache`);
      return buildResponse(messages, true, true);
    }

    // Fallback - return cache
    return buildResponse(messages, true, false);
  }

  // No data at all - first time, must wait for scrape
  console.log(`[SUPABASE] No cached data - scraping (first visit)...`);
  isScrapingInProgress = true;
  try {
    const result = await fetchAndMergeData();
    return {
      channels: result.channels,
      messages: result.messages,
      lastUpdated: result.lastUpdated,
      isCached: false,
      cacheAge: 0,
      isScrapingInBackground: false
    };
  } finally {
    isScrapingInProgress = false;
  }
}

// Fetch and merge data - UNLIMITED READS/WRITES!
async function fetchAndMergeData(): Promise<{
  channels: TelegramChannel[];
  messages: TelegramMessage[];
  lastUpdated: string | null;
  isCached: boolean;
  cacheAge: number | null;
}> {
  // Get existing messages FIRST to know when to stop scraping
  const dbMessages = await getAllMessages();
  const existingMessages = dbMessages.map(fromDbMessage);
  const existingMessageIds = new Set(existingMessages.map(m => m.id));
  console.log(`[SUPABASE] Found ${existingMessages.length} existing messages`);
  
  // Get blacklisted message IDs
  const blacklistedIds = await getBlacklistedIds();
  console.log(`[SUPABASE] Found ${blacklistedIds.size} blacklisted messages`);
  
  // Fetch all channels in parallel, passing existing message IDs
  const fetchPromises = CHANNELS.map(async (username) => {
    try {
      return await scrapeChannel(username, existingMessageIds, 50);
    } catch (error) {
      console.error(`[SCRAPER] Failed to fetch ${username}:`, error);
      return null;
    }
  });
  
  const fetchResults = await Promise.all(fetchPromises);
  
  const newChannels: TelegramChannel[] = [];
  const newMessages: TelegramMessage[] = [];
  
  for (const result of fetchResults) {
    if (result) {
      newChannels.push(result.channel);
      newMessages.push(...result.messages);
    }
  }
  
  // Filter out blacklisted messages from new messages
  const filteredNewMessages = newMessages.filter(msg => !blacklistedIds.has(msg.id));
  if (filteredNewMessages.length !== newMessages.length) {
    console.log(`[SUPABASE] Filtered out ${newMessages.length - filteredNewMessages.length} blacklisted messages`);
  }
  
  // Merge old and new messages
  const allMessages = mergeMessages(existingMessages, filteredNewMessages);
  console.log(`[SUPABASE] Merged: ${allMessages.length} total messages (${filteredNewMessages.length} new/updated)`);
  
  // Save all messages to Supabase (unlimited writes!)
  const dbMessagesToSave = allMessages.map(toDbMessage);
  await saveMessages(dbMessagesToSave);
  
  // Update last scrape time
  await setLastScrapeTime();
  
  console.log(`[SUPABASE] ✅ Unlimited reads/writes - no limits!`);
  
  const now = new Date().toISOString();
  const result = {
    channels: newChannels,
    messages: allMessages,
    lastUpdated: now,
    isCached: false,
    cacheAge: 0
  };
  
  return result;
}

// Get single channel with caching
export async function getChannel(
  username: string
): Promise<{ channel: TelegramChannel; messages: TelegramMessage[] } | null> {
  try {
    const result = await scrapeChannel(username);
    return result;
  } catch (error) {
    console.error(`Failed to scrape ${username}:`, error);
    return null;
  }
}

// Clear cache (call this after deleting messages)
export function clearTelegramCache(): void {
  console.log('[TELEGRAM] Cache cleared - next request will fetch fresh data');
}

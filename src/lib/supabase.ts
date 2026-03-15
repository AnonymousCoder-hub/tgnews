import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Types for our database (PostgreSQL uses lowercase column names)
export interface DbMessage {
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
  updatedat: string;
  twitterlink: string | null;
}

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

// Lazy-loaded Supabase client
let _supabase: SupabaseClient | null = null;

function createSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // During build time, return a dummy client that won't be used
  if (!supabaseUrl || !serviceRoleKey) {
    console.warn('[SUPABASE] Missing environment variables - using placeholder');
    return createClient('https://placeholder.supabase.co', 'placeholder-key');
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Export supabase client (lazy initialization)
export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!_supabase) {
      _supabase = createSupabaseClient();
    }
    return (_supabase as any)[prop];
  }
});

// In-memory cache for ultra-fast access
let memoryCache: {
  messages: DbMessage[];
  lastUpdated: string;
  expiresAt: number;
} | null = null;

// Memory cache duration (5 minutes)
const MEMORY_CACHE_TTL = 5 * 60 * 1000;

// Get all messages from database
export async function getAllMessages(): Promise<DbMessage[]> {
  // Check memory cache first
  if (memoryCache && memoryCache.expiresAt > Date.now()) {
    console.log('[SUPABASE] Memory cache hit');
    return memoryCache.messages;
  }

  try {
    const client = _supabase || createSupabaseClient();
    
    // Fetch all messages using pagination (Supabase has 1000 row limit per request)
    const allMessages: DbMessage[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('[SUPABASE] Error fetching messages:', error);
        break;
      }

      if (data && data.length > 0) {
        allMessages.push(...(data as DbMessage[]));
        offset += batchSize;
        hasMore = data.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`[SUPABASE] Fetched ${allMessages.length} messages from database`);
    
    // Update memory cache
    if (allMessages.length > 0) {
      memoryCache = {
        messages: allMessages,
        lastUpdated: new Date().toISOString(),
        expiresAt: Date.now() + MEMORY_CACHE_TTL,
      };
    }

    return allMessages;
  } catch (error) {
    console.error('[SUPABASE] Fetch error:', error);
    return [];
  }
}

// Save or update messages (batch upsert)
export async function saveMessages(messages: DbMessage[]): Promise<void> {
  if (messages.length === 0) return;

  try {
    const client = _supabase || createSupabaseClient();
    
    // Remove twitterlink field as it may not exist in the database schema
    const messagesToSave = messages.map(({ twitterlink, ...msg }) => msg);
    
    const { error } = await client
      .from('messages')
      .upsert(messagesToSave, { onConflict: 'id' });

    if (error) {
      console.error('[SUPABASE] Error saving messages:', error);
      return;
    }

    console.log(`[SUPABASE] Saved ${messages.length} messages ✅`);

    // Invalidate memory cache
    memoryCache = null;
  } catch (error) {
    console.error('[SUPABASE] Save error:', error);
  }
}

// Get last scrape time
export async function getLastScrapeTime(): Promise<Date | null> {
  try {
    const client = _supabase || createSupabaseClient();
    const { data, error } = await client
      .from('last_scrape')
      .select('timestamp')
      .eq('id', 'singleton')
      .single();

    if (error || !data) {
      return null;
    }

    return new Date(data.timestamp);
  } catch {
    return null;
  }
}

// Set last scrape time
export async function setLastScrapeTime(): Promise<void> {
  try {
    const client = _supabase || createSupabaseClient();
    await client
      .from('last_scrape')
      .upsert({ id: 'singleton', timestamp: new Date().toISOString() }, { onConflict: 'id' });
    console.log('[SUPABASE] Updated last scrape time');
  } catch (error) {
    console.error('[SUPABASE] Error setting last scrape time:', error);
  }
}

// Clear memory cache (for force refresh)
export function clearMemoryCache(): void {
  memoryCache = null;
}

// Blacklist interface
export interface BlacklistEntry {
  id: string;
  message_id: string;
  reason: string;
  deleted_at: string;
  message_preview: string | null;
  channel_username: string | null;
}

// In-memory blacklist cache
let blacklistCache: {
  ids: Set<string>;
  expiresAt: number;
} | null = null;

const BLACKLIST_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Get all blacklisted message IDs
export async function getBlacklistedIds(): Promise<Set<string>> {
  // Check memory cache first
  if (blacklistCache && blacklistCache.expiresAt > Date.now()) {
    return blacklistCache.ids;
  }

  try {
    const client = _supabase || createSupabaseClient();
    
    const { data, error } = await client
      .from('blacklist')
      .select('message_id');

    if (error) {
      console.error('[SUPABASE] Error fetching blacklist:', error);
      return new Set();
    }

    const ids = new Set(data?.map((item: { message_id: string }) => item.message_id) || []);
    
    // Cache the result
    blacklistCache = {
      ids,
      expiresAt: Date.now() + BLACKLIST_CACHE_TTL
    };

    console.log(`[SUPABASE] Loaded ${ids.size} blacklisted message IDs`);
    return ids;
  } catch (error) {
    console.error('[SUPABASE] Blacklist fetch error:', error);
    return new Set();
  }
}

// Check if a message ID is blacklisted
export async function isBlacklisted(messageId: string): Promise<boolean> {
  const blacklistedIds = await getBlacklistedIds();
  return blacklistedIds.has(messageId);
}

// Clear blacklist cache (when new items are added)
export function clearBlacklistCache(): void {
  blacklistCache = null;
}

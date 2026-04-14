import { Redis } from '@upstash/redis';

// Check if Redis is configured
const hasRedisConfig = process.env.UPSTASH_REDIS_REST_TOKEN && process.env.UPSTASH_REDIS_REST_TOKEN.length > 0;

// Only create Redis client if configured
export const redis = hasRedisConfig 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL || 'https://global.upstash.io',
      token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
    })
  : null;

// Cache keys - SIMPLIFIED!
export const CACHE_KEYS = {
  ALL_MESSAGES: 'tg:messages',        // Single key for ALL messages (JSON blob)
  LAST_SCRAPE: 'tg:last_scrape',      // Timestamp of last scrape
  MEMORY_CACHE: 'tg:cache',           // Separate key for memory cache (with TTL)
} as const;

// In-memory cache for ultra-fast access
const memoryCache = new Map<string, { data: unknown; expiresAt: number }>();

// Lock to prevent concurrent scrapes
let isScrapingInProgress = false;
let scrapingPromise: Promise<unknown> | null = null;

// Get scraping lock status
export function isCurrentlyScraping(): boolean {
  return isScrapingInProgress;
}

// Set scraping lock
export function setScrapingLock(promise: Promise<unknown> | null): void {
  isScrapingInProgress = promise !== null;
  scrapingPromise = promise;
}

export function getScrapingPromise(): Promise<unknown> | null {
  return scrapingPromise;
}

// Helper function to get from memory cache
function getMemoryCache<T>(key: string): T | null {
  const cached = memoryCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }
  memoryCache.delete(key);
  return null;
}

// Helper function to set memory cache
function setMemoryCache<T>(key: string, value: T, ttlSeconds: number): void {
  memoryCache.set(key, {
    data: value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
}

// Get from cache (memory first, then Redis)
export async function getCached<T>(key: string): Promise<T | null> {
  // Check memory cache first (instant)
  const memCached = getMemoryCache<T>(key);
  if (memCached) {
    return memCached;
  }

  // Check Redis if configured
  if (redis) {
    try {
      const data = await redis.get<T>(key);
      if (data) {
        // Store in memory for next time (5 min TTL)
        setMemoryCache(key, data, 300);
        return data;
      }
    } catch (error) {
      console.error('Redis get error:', error);
    }
  }

  return null;
}

// Set cache (both memory and Redis)
export async function setCache<T>(key: string, value: T, ttlSeconds = 300): Promise<void> {
  // Always set memory cache (instant access)
  setMemoryCache(key, value, ttlSeconds);

  // Set Redis if configured
  if (redis) {
    try {
      await redis.set(key, value, { ex: ttlSeconds });
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
}

// Get last scrape timestamp from Redis
export async function getLastScrapeTime(): Promise<Date | null> {
  if (!redis) return null;
  
  try {
    const timestamp = await redis.get<string>(CACHE_KEYS.LAST_SCRAPE);
    if (timestamp) {
      return new Date(timestamp);
    }
  } catch (error) {
    console.error('Redis get last scrape error:', error);
  }
  return null;
}

// Set last scrape timestamp
export async function setLastScrapeTime(): Promise<void> {
  if (!redis) return;
  
  try {
    await redis.set(CACHE_KEYS.LAST_SCRAPE, new Date().toISOString());
  } catch (error) {
    console.error('Redis set last scrape error:', error);
  }
}

// Get all messages (ONE command - gets the whole JSON blob)
export async function getAllMessages<T>(): Promise<T[]> {
  if (!redis) {
    console.log('[REDIS] No Redis client configured');
    return [];
  }
  
  try {
    const messages = await redis.get<T[]>(CACHE_KEYS.ALL_MESSAGES);
    
    // Handle all edge cases - ensure we always return an array
    if (!messages) {
      console.log(`[REDIS] No messages found`);
      return [];
    }
    
    if (!Array.isArray(messages)) {
      // Corrupted data - delete it and return empty
      console.log(`[REDIS] Found corrupted data (type=${typeof messages}), deleting...`);
      await redis.del(CACHE_KEYS.ALL_MESSAGES);
      return [];
    }
    
    console.log(`[REDIS] Retrieved ${messages.length} messages`);
    return messages;
  } catch (error) {
    console.error('Redis get messages error:', error);
    return [];
  }
}

// Save all messages (ONE command - sets the whole JSON blob)
export async function saveAllMessages<T extends { id: string; timestamp: string }>(
  messages: T[]
): Promise<void> {
  if (!redis || messages.length === 0) return;
  
  try {
    // Filter messages older than 100 days
    const cutoff = Date.now() - (100 * 24 * 60 * 60 * 1000);
    const filtered = messages.filter(m => new Date(m.timestamp).getTime() > cutoff);
    
    // Keep only latest 500 messages to prevent blob from growing too large
    const toSave = filtered.slice(0, 500);
    
    // ONE command to save everything
    await redis.set(CACHE_KEYS.ALL_MESSAGES, toSave);
    console.log(`[REDIS] Saved ${toSave.length} messages (1 command)`);
  } catch (error) {
    console.error('Redis save messages error:', error);
  }
}

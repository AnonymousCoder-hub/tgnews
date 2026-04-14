import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Old keys that should be cleaned up (from previous inefficient implementation)
const OLD_KEYS = [
  'tg:persistent:messages',     // Old HSET format
  'tg:message_timestamps',      // Old sorted set
  'tg:all:messages',            // Old cache key
  'tg:channels',                // Old channels cache
];

export async function GET() {
  if (!redis) {
    return NextResponse.json({ error: 'Redis not configured' }, { status: 500 });
  }

  try {
    const results: {
      scanned: string[];
      deleted: string[];
      currentData: { key: string; type: string; size?: number | string; status: string }[];
      errors: string[];
    } = {
      scanned: [],
      deleted: [],
      currentData: [],
      errors: []
    };

    // Scan for all keys starting with 'tg:'
    let cursor: number | string = 0;
    let allKeys: string[] = [];
    
    do {
      const result = await redis.scan(cursor, { match: 'tg:*', count: 100 });
      cursor = result[0];
      allKeys = allKeys.concat(result[1]);
    } while (cursor !== 0);

    results.scanned = allKeys;

    // Delete old format keys
    for (const key of allKeys) {
      if (OLD_KEYS.includes(key)) {
        try {
          await redis.del(key);
          results.deleted.push(key);
        } catch (e) {
          results.errors.push(`Failed to delete ${key}: ${e}`);
        }
      }
    }

    // Check current keys
    for (const key of allKeys) {
      if (key === 'tg:messages') {
        try {
          const type = await redis.type(key);
          const data = await redis.get(key);
          
          if (Array.isArray(data)) {
            results.currentData.push({ 
              key, 
              type, 
              size: data.length + ' messages',
              status: '✅ Valid array - all good!'
            });
          } else if (data && typeof data === 'object') {
            // Old corrupted data - delete it
            await redis.del(key);
            results.deleted.push(key + ' (corrupted object format)');
            results.currentData.push({ 
              key, 
              type, 
              size: 'N/A',
              status: '❌ Was corrupted object - DELETED'
            });
          } else {
            results.currentData.push({ 
              key, 
              type, 
              size: 'empty',
              status: '⚠️ Empty or unknown format'
            });
          }
        } catch (e) {
          results.errors.push(`Failed to inspect ${key}: ${e}`);
        }
      } else if (key === 'tg:last_scrape') {
        try {
          const data = await redis.get(key);
          results.currentData.push({ 
            key, 
            type: 'string', 
            size: data ? 'timestamp set' : 'empty',
            status: '✅ Last scrape time'
          });
        } catch (e) {
          results.errors.push(`Failed to inspect ${key}: ${e}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Redis cleanup complete!',
      results,
      summary: {
        totalKeysFound: allKeys.length,
        oldKeysDeleted: results.deleted.length,
        currentKeys: results.currentData.length,
        note: 'Only 2 keys needed: tg:messages (array) and tg:last_scrape (timestamp)'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Cleanup failed' },
      { status: 500 }
    );
  }
}

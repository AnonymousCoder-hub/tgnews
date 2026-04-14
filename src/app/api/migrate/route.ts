import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis';
import { supabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    console.log('[MIGRATE] Starting migration from Redis to Supabase...');

    // 1. Get all messages from Redis
    let redisMessages: any[] = [];
    if (redis) {
      const data = await redis.get<any[]>('tg:messages');
      if (Array.isArray(data)) {
        redisMessages = data;
      }
    }
    console.log('[MIGRATE] Found in Redis:', redisMessages.length);

    // 2. Migrate messages if they exist
    let messagesCount = 0;
    if (redisMessages.length > 0) {
      // Transform messages to Supabase format (lowercase column names!)
      const supabaseMessages = redisMessages.map(msg => ({
        id: msg.id,
        postid: msg.postId,
        channelusername: msg.channelUsername,
        channelname: msg.channelName,
        channelavatar: msg.channelAvatar || null,
        text: msg.text || null,
        views: msg.views || 0,
        timestamp: msg.timestamp,
        photos: msg.photos || [],
        videos: msg.videos || null,
        haslargemedia: msg.hasLargeMedia || false,
        largemediainfo: msg.largeMediaInfo || null,
        reactions: msg.reactions || null,
        storedat: msg.storedAt || new Date().toISOString(),
        updatedat: new Date().toISOString(),
      }));

      // Insert into Supabase (upsert to handle duplicates)
      const { error: insertError } = await supabase
        .from('messages')
        .upsert(supabaseMessages, { onConflict: 'id' });

      if (insertError) {
        console.error('[MIGRATE] Insert error:', insertError);
        return NextResponse.json({
          success: false,
          error: 'Failed to insert messages',
          details: insertError
        }, { status: 500 });
      }

      messagesCount = supabaseMessages.length;
      console.log(`[MIGRATE] Migrated ${messagesCount} messages to Supabase`);
    }

    // 3. Migrate last_scrape time
    let scrapeTime: string | null = null;
    if (redis) {
      const lastScrapeTime = await redis.get<string>('tg:last_scrape');
      if (lastScrapeTime) {
        await supabase
          .from('last_scrape')
          .upsert({ id: 'singleton', timestamp: lastScrapeTime }, { onConflict: 'id' });
        scrapeTime = lastScrapeTime;
        console.log('[MIGRATE] Migrated last_scrape time:', scrapeTime);
      }
    }

    // 4. Verify migration
    const { data: verifyMessages } = await supabase
      .from('messages')
      .select('id');

    const { data: verifyScrape } = await supabase
      .from('last_scrape')
      .select('timestamp')
      .eq('id', 'singleton')
      .single();

    return NextResponse.json({
      success: true,
      message: 'Migration complete! 🎉',
      results: {
        messagesMigrated: messagesCount,
        lastScrapeMigrated: scrapeTime || 'not found in Redis',
        supabaseVerification: {
          messagesCount: verifyMessages?.length || 0,
          lastScrapeTime: verifyScrape?.timestamp || 'not set'
        }
      },
      note: 'You can now safely stop using Redis. Data is in Supabase with UNLIMITED reads/writes!'
    });

  } catch (error) {
    console.error('[MIGRATE] Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';

function isAllowedRequest(request: NextRequest): boolean {
  const providedSecret = request.headers.get('x-api-secret');
  return providedSecret === API_SECRET;
}

/**
 * GET /api/admin/messages
 * 
 * Fetch all messages for admin panel (no pagination limit)
 * Uses pagination to fetch beyond Supabase's 1000 row default limit
 */
export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Fetch all messages using pagination (Supabase limits to 1000 per request)
    const allMessages: Record<string, unknown>[] = [];
    const pageSize = 1000;
    let page = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await client
        .from('messages')
        .select('*')
        .order('timestamp', { ascending: false })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (error) {
        console.error('[ADMIN-MSGS] Error fetching page:', error);
        break;
      }

      if (data && data.length > 0) {
        allMessages.push(...data);
        page++;
        
        // If we got less than pageSize, we've reached the end
        if (data.length < pageSize) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    // Get total count
    const { count } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true });

    // Transform to match expected format
    const messages = allMessages.map(db => ({
      id: db.id,
      postId: db.postid,
      channelUsername: db.channelusername,
      channelName: db.channelname,
      channelAvatar: db.channelavatar,
      text: db.text,
      views: db.views,
      timestamp: db.timestamp,
      photos: db.photos || [],
      videos: db.videos || [],
      hasLargeMedia: db.haslargemedia,
      largeMediaInfo: db.largemediainfo,
      reactions: db.reactions || [],
    }));

    // Get unique channels
    const channelMap = new Map<string, { username: string; name: string }>();
    for (const msg of messages) {
      if (!channelMap.has(msg.channelUsername)) {
        channelMap.set(msg.channelUsername, {
          username: msg.channelUsername,
          name: msg.channelName
        });
      }
    }
    const channels = Array.from(channelMap.values());

    console.log(`[ADMIN-MSGS] Fetched ${messages.length} messages, ${channels.length} channels`);

    return NextResponse.json({
      success: true,
      data: {
        messages,
        channels,
        total: count || messages.length,
      }
    });

  } catch (error) {
    console.error('[ADMIN-MSGS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

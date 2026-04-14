import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function GET(request: NextRequest) {
  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Get total count
    const { count: total, error: totalError } = await client
      .from('messages')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) {
      return NextResponse.json({ success: false, error: totalError.message }, { status: 500 });
    }

    // Get count by channel
    const { data: channelData, error: channelError } = await client
      .from('messages')
      .select('channelusername');
    
    if (channelError) {
      return NextResponse.json({ success: false, error: channelError.message }, { status: 500 });
    }

    // Count by channel
    const byChannel: Record<string, number> = {};
    for (const msg of channelData || []) {
      byChannel[msg.channelusername] = (byChannel[msg.channelusername] || 0) + 1;
    }

    // Get oldest and newest messages
    const { data: oldestMsg } = await client
      .from('messages')
      .select('timestamp')
      .order('timestamp', { ascending: true })
      .limit(1)
      .single();
    
    const { data: newestMsg } = await client
      .from('messages')
      .select('timestamp')
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({
      success: true,
      stats: {
        total: total || 0,
        byChannel,
        oldestMessage: oldestMsg?.timestamp || null,
        newestMessage: newestMsg?.timestamp || null,
      }
    });
  } catch (error) {
    console.error('[DB-STATS] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

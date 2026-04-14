import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  try {
    const client = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const body = await request.json();
    const { type, channel, days } = body;

    let deletedCount = 0;
    let message = '';

    switch (type) {
      case 'last50': {
        // Get the IDs of the last 50 messages
        const { data: last50 } = await client
          .from('messages')
          .select('id')
          .order('timestamp', { ascending: false })
          .limit(50);
        
        if (last50 && last50.length > 0) {
          const ids = last50.map(m => m.id);
          const { error } = await client
            .from('messages')
            .delete()
            .in('id', ids);
          
          if (error) throw error;
          deletedCount = ids.length;
          message = `Deleted ${deletedCount} most recent messages`;
        }
        break;
      }

      case 'olderThan7': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const { data: oldMessages } = await client
          .from('messages')
          .select('id')
          .lt('timestamp', sevenDaysAgo.toISOString());
        
        if (oldMessages && oldMessages.length > 0) {
          const ids = oldMessages.map(m => m.id);
          const { error } = await client
            .from('messages')
            .delete()
            .in('id', ids);
          
          if (error) throw error;
          deletedCount = ids.length;
          message = `Deleted ${deletedCount} messages older than 7 days`;
        } else {
          message = 'No messages older than 7 days found';
        }
        break;
      }

      case 'olderThan30': {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const { data: oldMessages } = await client
          .from('messages')
          .select('id')
          .lt('timestamp', thirtyDaysAgo.toISOString());
        
        if (oldMessages && oldMessages.length > 0) {
          const ids = oldMessages.map(m => m.id);
          const { error } = await client
            .from('messages')
            .delete()
            .in('id', ids);
          
          if (error) throw error;
          deletedCount = ids.length;
          message = `Deleted ${deletedCount} messages older than 30 days`;
        } else {
          message = 'No messages older than 30 days found';
        }
        break;
      }

      case 'olderThanCustom': {
        const customDays = days || 7;
        if (customDays < 1 || customDays > 365) {
          return NextResponse.json({ 
            success: false, 
            error: 'Days must be between 1 and 365' 
          }, { status: 400 });
        }
        
        const customDateAgo = new Date();
        customDateAgo.setDate(customDateAgo.getDate() - customDays);
        
        const { data: oldMessages } = await client
          .from('messages')
          .select('id')
          .lt('timestamp', customDateAgo.toISOString());
        
        if (oldMessages && oldMessages.length > 0) {
          const ids = oldMessages.map(m => m.id);
          const { error } = await client
            .from('messages')
            .delete()
            .in('id', ids);
          
          if (error) throw error;
          deletedCount = ids.length;
          message = `Deleted ${deletedCount} messages older than ${customDays} day${customDays !== 1 ? 's' : ''}`;
        } else {
          message = `No messages older than ${customDays} day${customDays !== 1 ? 's' : ''} found`;
        }
        break;
      }

      case 'channel': {
        if (!channel) {
          return NextResponse.json({ 
            success: false, 
            error: 'Channel name required' 
          }, { status: 400 });
        }
        
        const { error, count } = await client
          .from('messages')
          .delete({ count: 'exact' })
          .eq('channelusername', channel);
        
        if (error) throw error;
        deletedCount = count || 0;
        message = `Deleted ${deletedCount} messages from ${channel}`;
        break;
      }

      default:
        return NextResponse.json({ 
          success: false, 
          error: 'Invalid cleanup type' 
        }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      deleted: deletedCount,
      message
    });

  } catch (error) {
    console.error('[CLEANUP] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

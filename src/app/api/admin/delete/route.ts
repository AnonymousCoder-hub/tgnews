import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { jwtVerify } from 'jose';
import { createClient } from '@supabase/supabase-js';
import { clearTelegramCache } from '@/lib/telegram-scraper';
import { clearMemoryCache, clearBlacklistCache } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COOKIE_NAME = 'admin_session';

// Get JWT secret
const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
};

// Verify JWT token (same as auth route)
async function verifyToken(token: string): Promise<{ username: string; role: string } | null> {
  const secret = getJwtSecret();
  if (!secret) return null;
  
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as { username: string; role: string };
  } catch {
    return null;
  }
}

// Verify admin session
async function verifyAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!token) return false;
    
    const payload = await verifyToken(token);
    return payload?.role === 'admin';
  } catch {
    return false;
  }
}

// Create Supabase client
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[ADMIN DELETE] Missing Supabase credentials');
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// POST - Delete a message and add to blacklist
export async function POST(request: NextRequest) {
  const requestId = Date.now().toString(36);
  console.log(`[${requestId}] ADMIN DELETE: Starting...`);
  
  try {
    // Verify admin authentication
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
      console.log(`[${requestId}] ADMIN DELETE: Unauthorized`);
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get Supabase client
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { success: false, error: 'Database connection failed' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { messageId, reason } = body;

    if (!messageId) {
      return NextResponse.json(
        { success: false, error: 'Message ID required' },
        { status: 400 }
      );
    }

    console.log(`[${requestId}] ADMIN DELETE: Deleting message: ${messageId}`);

    // 1. Get message details before deletion
    const { data: messageData } = await supabase
      .from('messages')
      .select('id, text, channelusername')
      .eq('id', messageId)
      .single();

    // 2. Delete from messages table
    const { data: deletedData, error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('id', messageId)
      .select('id');

    if (deleteError) {
      console.error(`[${requestId}] ADMIN DELETE: Error:`, deleteError);
      return NextResponse.json(
        { success: false, error: `Failed to delete: ${deleteError.message}` },
        { status: 500 }
      );
    }

    const wasDeleted = deletedData && deletedData.length > 0;
    console.log(`[${requestId}] ADMIN DELETE: ${wasDeleted ? 'Deleted from DB' : 'Not in DB'}`);

    // 3. Add to blacklist
    const { error: blacklistError } = await supabase
      .from('blacklist')
      .upsert({
        message_id: messageId,
        reason: reason || 'Deleted by admin',
        deleted_at: new Date().toISOString(),
        message_preview: messageData?.text?.substring(0, 200) || null,
        channel_username: messageData?.channelusername || null
      }, { onConflict: 'message_id' });

    if (blacklistError) {
      console.error(`[${requestId}] ADMIN DELETE: Blacklist error:`, blacklistError);
    } else {
      console.log(`[${requestId}] ADMIN DELETE: Added to blacklist`);
    }

    // Clear ALL caches so the change is immediately visible
    clearTelegramCache();
    clearMemoryCache();
    clearBlacklistCache();

    console.log(`[${requestId}] ADMIN DELETE: ✅ Complete (all caches cleared)`);

    return NextResponse.json({
      success: true,
      message: wasDeleted ? 'Message deleted and blacklisted' : 'Added to blacklist',
      messageId,
      wasInDb: wasDeleted
    });
  } catch (error) {
    console.error(`[${requestId}] ADMIN DELETE: Unexpected error:`, error);
    return NextResponse.json(
      { success: false, error: `Delete failed: ${error instanceof Error ? error.message : 'Unknown'}` },
      { status: 500 }
    );
  }
}

// GET - Get blacklist entries
export async function GET(request: NextRequest) {
  try {
    const isAdmin = await verifyAdmin();
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    const { data, error, count } = await supabase
      .from('blacklist')
      .select('*', { count: 'exact' })
      .order('deleted_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to get blacklist' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data, total: count });
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Failed to get blacklist' }, { status: 500 });
  }
}

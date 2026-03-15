import { NextRequest, NextResponse } from 'next/server';
import { supabase, clearMemoryCache } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';
const ALLOWED_DOMAINS = ['newstel.vercel.app', 'localhost:3000'];

function isAllowedRequest(request: NextRequest): boolean {
  const providedSecret = request.headers.get('x-api-secret');
  if (providedSecret === API_SECRET) return true;

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (ALLOWED_DOMAINS.some(domain => originUrl.host === domain)) return true;
    } catch {}
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (ALLOWED_DOMAINS.some(domain => refererUrl.host === domain) && refererUrl.pathname !== '/api/') {
        return true;
      }
    } catch {}
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
  }

  try {
    let deletedNullPostId = 0;
    let fixedLargeMedia = 0;

    const { count: deletedCount } = await supabase
      .from('messages')
      .delete()
      .is('postid', null);

    deletedNullPostId = deletedCount || 0;

    const { data: largeMediaMessages } = await supabase
      .from('messages')
      .select('id, largemediainfo')
      .eq('haslargemedia', true);

    if (largeMediaMessages) {
      for (const msg of largeMediaMessages) {
        const info = msg.largemediainfo as { type?: string; thumbnailUrl?: string } | null;
        if (info && info.type === 'video' && !info.thumbnailUrl) {
          await supabase
            .from('messages')
            .update({ haslargemedia: false, largemediainfo: null })
            .eq('id', msg.id);
          fixedLargeMedia++;
        }
      }
    }

    clearMemoryCache();

    const { count: totalMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true });

    const { count: remainingLargeMedia } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('haslargemedia', true);

    return NextResponse.json({
      success: true,
      actions: { deletedNullPostId, fixedFalsePositives: fixedLargeMedia },
      stats: { totalMessages: totalMessages || 0, actualLargeMedia: remainingLargeMedia || 0 }
    });
  } catch (error) {
    return NextResponse.json({ error: 'Fix failed' }, { status: 500 });
  }
}

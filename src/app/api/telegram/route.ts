import { NextRequest, NextResponse } from 'next/server';
import { getAllChannels, CHANNELS } from '@/lib/telegram-scraper';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Secret token that must be passed to access the API
// The frontend includes this, but direct access won't have it
const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';

// Allowed domains
const ALLOWED_DOMAINS = ['newstel.vercel.app', 'localhost:3000'];

function isAllowedRequest(request: NextRequest): boolean {
  // Method 1: Check for secret header (set by our frontend)
  const providedSecret = request.headers.get('x-api-secret');
  if (providedSecret === API_SECRET) {
    return true;
  }

  // Method 2: Check origin/referer (for browser requests from our site)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (ALLOWED_DOMAINS.some(domain => originUrl.host === domain)) {
        return true;
      }
    } catch {}
  }

  if (referer) {
    try {
      const refererUrl = new URL(referer);
      // Only allow if referer is from our domain AND they were on a page (not direct)
      if (ALLOWED_DOMAINS.some(domain => refererUrl.host === domain) && refererUrl.pathname !== '/api/') {
        return true;
      }
    } catch {}
  }

  return false;
}

export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const refresh = searchParams.get('refresh') === 'true';

  try {
    const result = await getAllChannels(refresh);
    return NextResponse.json({
      success: true,
      data: {
        channels: result.channels,
        messages: result.messages,
        lastUpdated: result.lastUpdated
      },
      meta: {
        isCached: result.isCached,
        cacheAge: result.cacheAge,
        availableChannels: CHANNELS
      }
    });
  } catch (error) {
    console.error('Telegram API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

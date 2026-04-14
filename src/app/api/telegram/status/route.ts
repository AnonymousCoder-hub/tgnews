import { NextRequest, NextResponse } from 'next/server';
import { getScrapeStatus } from '@/lib/data-layer';

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
      if (ALLOWED_DOMAINS.some(domain => refererUrl.host === domain)) return true;
    } catch {}
  }
  
  return false;
}

/**
 * GET /api/telegram/status
 * 
 * Lightweight endpoint for polling scrape status.
 * Frontend should poll this every few seconds to check if new data is available.
 * 
 * Response:
 * - isScraping: boolean
 * - lastScrapeTime: string | null
 * - cacheAgeSeconds: number
 * - isDataFresh: boolean
 * - totalMessages: number
 */
export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }
  
  try {
    const status = await getScrapeStatus();
    
    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    console.error('[API] Status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get status' },
      { status: 500 }
    );
  }
}

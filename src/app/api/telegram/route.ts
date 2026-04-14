import { NextRequest, NextResponse } from 'next/server';
import { 
  getPaginatedMessages, 
  runScraper,
  getAllChannels,
  CHANNELS,
  globalScrapeState,
  getLastScrapeTime,
  ensureEnglishTranslations
} from '@/lib/data-layer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Secret token for API access
const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';

// Allowed domains
const ALLOWED_DOMAINS = ['newstel.vercel.app', 'localhost:3000'];

// Fresh data threshold
const FRESH_DATA_THRESHOLD_SECONDS = 60;

function isAllowedRequest(request: NextRequest): boolean {
  // Check for secret header
  const providedSecret = request.headers.get('x-api-secret');
  if (providedSecret === API_SECRET) return true;
  
  // Check origin/referer
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
 * Start a background scrape (fire-and-forget).
 * Does NOT block the response - the scrape runs independently.
 */
function startBackgroundScrape(reason: string): void {
  if (globalScrapeState.isScraping) {
    console.log(`[API] Scrape already in progress, skipping (${reason})`);
    return;
  }
  
  globalScrapeState.isScraping = true;
  globalScrapeState.scrapeStartTime = new Date();
  
  // Fire-and-forget: don't await, let it run in background
  // Errors are caught internally
  (async () => {
    console.log(`[API] Starting background scrape (${reason})`);
    try {
      const count = await runScraper();
      console.log(`[API] Background scrape complete: ${count} new messages`);
    } catch (error) {
      console.error('[API] Background scrape error:', error);
    } finally {
      globalScrapeState.isScraping = false;
      globalScrapeState.lastScrapeTime = new Date();
    }
  })();
}

/**
 * GET /api/telegram
 * 
 * Query params:
 * - page: Page number (default: 1)
 * - limit: Messages per page (default: 20, max: 50)
 * - refresh: 'true' to trigger a background scrape (non-blocking - returns cached data immediately)
 * - search: Search query to filter messages
 * - channel: Filter by channel username
 * - media: Filter by media type ('all', 'photos', 'videos', 'none')
 * 
 * ARCHITECTURE:
 * ALWAYS returns cached data immediately (never blocks).
 * Scraping runs in the background and the frontend polls for completion.
 * 
 * OLD: refresh=true → API blocks 15-20s → scrape + translate → return
 * NEW: refresh=true → API returns cached data (<1s) → background: scrape → save raw → translate
 */
export async function GET(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json(
      { success: false, error: 'Access denied' },
      { status: 403 }
    );
  }
  
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
  const refresh = searchParams.get('refresh') === 'true';
  const search = searchParams.get('search') || undefined;
  const channel = searchParams.get('channel') || undefined;
  const media = (searchParams.get('media') as 'all' | 'photos' | 'videos' | 'none') || undefined;
  
  try {
    const isFiltering = search || channel || (media && media !== 'all');
    
    // If user explicitly requested refresh, trigger a BACKGROUND scrape
    if (refresh && !isFiltering) {
      startBackgroundScrape('manual refresh');
    }
    
    // If not explicit refresh but data is stale, trigger background scrape
    if (!refresh && !isFiltering && !globalScrapeState.isScraping) {
      const lastScrapeTime = await getLastScrapeTime();
      const cacheAgeSeconds = lastScrapeTime 
        ? Math.floor((Date.now() - lastScrapeTime.getTime()) / 1000)
        : Infinity;
      
      if (cacheAgeSeconds > FRESH_DATA_THRESHOLD_SECONDS) {
        startBackgroundScrape(`stale data (${cacheAgeSeconds}s old)`);
      }
    }
    
    // ALWAYS return cached data immediately (even on refresh)
    const result = await getPaginatedMessages(page, limit, false, search, channel, media);
    
    // CRITICAL SAFETY NET: Translate any Arabic/Urdu text before sending to user
    // This guarantees NO non-English text ever reaches the frontend
    const translatedMessages = await ensureEnglishTranslations(result.messages);
    
    return NextResponse.json({
      success: true,
      data: {
        messages: translatedMessages,
        channels: result.channels,
        total: result.total,
        todayCount: result.todayCount,
        page: result.page,
        limit: result.limit,
        hasMore: result.hasMore,
        lastUpdated: result.lastUpdated,
      },
      meta: {
        cacheAgeSeconds: result.cacheAgeSeconds,
        isScraping: globalScrapeState.isScraping,
        availableChannels: CHANNELS,
        searchQuery: search,
        channelFilter: channel,
        mediaFilter: media,
      },
    });
  } catch (error) {
    console.error('[API] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch data' },
      { status: 500 }
    );
  }
}

/**
 * Get all channels for filter UI (lightweight endpoint)
 */
export async function HEAD(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return NextResponse.json({ success: false }, { status: 403 });
  }
  
  try {
    const channels = await getAllChannels();
    return NextResponse.json({ success: true, channels });
  } catch (error) {
    return NextResponse.json({ success: false, status: 500 });
  }
}

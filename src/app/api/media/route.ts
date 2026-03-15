import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const API_SECRET = process.env.API_SECRET || 'newstel-internal-2024';
const ALLOWED_DOMAINS = ['newstel.vercel.app', 'localhost:3000'];

const ALLOWED_MEDIA_HOSTS = [
  'telesco.pe',
  'cdn1.telesco.pe',
  'cdn2.telesco.pe',
  'cdn3.telesco.pe',
  'cdn4.telesco.pe',
  'cdn5.telesco.pe',
  'telegram.org',
];

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
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');
  const type = searchParams.get('type') || 'image';

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  try {
    const mediaUrl = new URL(url);
    if (!ALLOWED_MEDIA_HOSTS.some(host => mediaUrl.hostname.endsWith(host))) {
      return NextResponse.json({ error: 'Invalid media source' }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  try {
    if (type === 'video') {
      return await streamVideo(url, request);
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch media' }, { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' },
    });
  } catch (error) {
    console.error('Media proxy error:', error);
    return NextResponse.json({ error: 'Failed to proxy media' }, { status: 500 });
  }
}

async function streamVideo(url: string, request: NextRequest): Promise<NextResponse> {
  const rangeHeader = request.headers.get('range');
  const headers: HeadersInit = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
  };

  if (rangeHeader) headers['Range'] = rangeHeader;

  const response = await fetch(url, { headers });

  if (!response.ok && response.status !== 206) {
    return NextResponse.json({ error: 'Failed to fetch video' }, { status: response.status });
  }

  const contentType = response.headers.get('content-type') || 'video/mp4';
  const contentLength = response.headers.get('content-length');
  const contentRange = response.headers.get('content-range');

  const responseHeaders: HeadersInit = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=3600',
  };

  if (contentLength) responseHeaders['Content-Length'] = contentLength;
  if (contentRange) responseHeaders['Content-Range'] = contentRange;
  responseHeaders['Accept-Ranges'] = 'bytes';

  return new NextResponse(response.body, {
    status: response.status === 206 ? 206 : 200,
    headers: responseHeaders,
  });
}

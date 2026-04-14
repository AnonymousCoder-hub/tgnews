import { NextResponse } from 'next/server';

// ADSB.lol API proxy - correct endpoints
// API: https://api.adsb.lol
// License: ODbL 1.0 (Open Data)

interface Aircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number;
  gs?: number;
  track?: number;
  calc_track?: number;
  type?: string;
  t?: string;
  r?: string;
  dbFlags?: number;
  seen?: number;
  seen_pos?: number;
  squawk?: string;
  category?: string;
}

interface ADSBResponse {
  ac: Aircraft[];
  now?: number;
  total?: number;
}

// Cache for API responses
let cache: {
  data: Aircraft[] | null;
  timestamp: number;
  type: string;
} = { data: null, timestamp: 0, type: '' };

const CACHE_TTL = 30000; // 30 seconds (increased from 15s for better performance)

// Pre-warmed cache - load immediately on server start
let isWarming = false;
async function warmCache() {
  if (isWarming || cache.data) return;
  isWarming = true;
  try {
    const response = await fetch('https://api.adsb.lol/v2/mil', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(20000),
    });
    if (response.ok) {
      const data: ADSBResponse = await response.json();
      cache = { data: data.ac || [], timestamp: Date.now(), type: 'military' };
      console.log(`[ADSB API] Cache pre-warmed with ${cache.data?.length || 0} aircraft`);
    }
  } catch (e) {
    console.log('[ADSB API] Cache warm failed, will fetch on first request');
  }
  isWarming = false;
}
// Start warming cache immediately
warmCache();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'all'; // all, military, cargo, commercial

  // Check cache
  if (cache.data && Date.now() - cache.timestamp < CACHE_TTL && cache.type === type) {
    const processed = processAircraft(cache.data, type);
    return NextResponse.json({
      now: Date.now(),
      total: processed.length,
      aircraft: processed,
      cached: true,
    });
  }

  try {
    // Use correct endpoint based on type
    let endpoint = 'https://api.adsb.lol/v2/mil'; // Default to military

    if (type === 'all') {
      // Get military for now (full dataset is too large)
      endpoint = 'https://api.adsb.lol/v2/mil';
    } else if (type === 'military') {
      endpoint = 'https://api.adsb.lol/v2/mil';
    }

    const response = await fetch(endpoint, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      if (cache.data) {
        const processed = processAircraft(cache.data, type);
        return NextResponse.json({
          now: Date.now(),
          total: processed.length,
          aircraft: processed,
          cached: true,
          error: 'API unavailable, using cache',
        });
      }
      return NextResponse.json(
        { error: 'Failed to fetch aircraft data', total: 0, aircraft: [] },
        { status: 502 }
      );
    }

    const data: ADSBResponse = await response.json();
    const aircraft = data.ac || [];

    // Update cache
    cache = { data: aircraft, timestamp: Date.now(), type };

    const processed = processAircraft(aircraft, type);

    console.log(`[ADSB API] Fetched ${processed.length} ${type} aircraft`);

    return NextResponse.json({
      now: Date.now(),
      total: processed.length,
      aircraft: processed,
      cached: false,
    });
  } catch (error) {
    console.error('[ADSB API] Error:', error);

    if (cache.data) {
      const processed = processAircraft(cache.data, type);
      return NextResponse.json({
        now: Date.now(),
        total: processed.length,
        aircraft: processed,
        cached: true,
        error: 'API timeout, using cache',
      });
    }

    return NextResponse.json(
      { error: 'Service temporarily unavailable', total: 0, aircraft: [] },
      { status: 503 }
    );
  }
}

function processAircraft(aircraft: Aircraft[], type: string) {
  return aircraft
    .filter(ac => ac.lat && ac.lon) // Only aircraft with position
    .map(ac => ({
      hex: ac.hex,
      flight: ac.flight ? String(ac.flight).trim() : undefined,
      lat: ac.lat,
      lng: ac.lon,
      alt_baro: ac.alt_baro,
      gs: ac.gs,
      track: ac.track ?? ac.calc_track,
      type: ac.t || ac.type,
      registration: ac.r,
      seen: ac.seen_pos ?? ac.seen,
      squawk: ac.squawk,
      category: ac.category,
      dbFlags: ac.dbFlags,
      // Determine aircraft category
      aircraftType: getAircraftType(ac),
      military: isMilitary(ac),
    }));
}

function getAircraftType(ac: Aircraft): 'military' | 'cargo' | 'commercial' | 'general' | 'helicopter' {
  const type = String(ac.t || ac.type || '').toUpperCase();
  const flight = String(ac.flight || '').trim().toUpperCase();

  // Helicopter types
  const heliTtypes = ['H60', 'H64', 'H53', 'H47', 'H65', 'H1', 'H2', 'EC', 'BK', 'AS3', 'AS5', 'AW', 'S70', 'S76', 'BELL', 'R44', 'R66', 'EC135', 'EC145', 'EC155'];
  if (heliTtypes.some(h => type.includes(h.replace(/[-]/g, '')))) return 'helicopter';

  // Military - check dbFlags
  if (ac.dbFlags && (ac.dbFlags & 1)) return 'military';

  // Military callsigns
  const milPatterns = [/^Q[A-Z]/, /^RCH/, /^ATLAS/, /^USAF/, /^USN/, /^USMC/, /^RAF/, /^NATO/, /^VKS/, /^RF-/];
  if (milPatterns.some(p => p.test(flight))) return 'military';

  // Military types
  const milTypes = ['F15', 'F16', 'F18', 'F22', 'F35', 'F-15', 'F-16', 'F-18', 'F-22', 'F-35', 'A10', 'B1', 'B2', 'B52', 'C130', 'C17', 'C5', 'KC135', 'E3', 'P8', 'SU27', 'SU30', 'MIG29', 'TU95', 'C30J'];
  if (milTypes.some(m => type.includes(m.replace(/[-]/g, '')))) return 'military';

  // Cargo airlines
  const cargoAirlines = ['FDX', 'UPS', 'DHL', 'FX', '5X', 'GTI', 'GEC', 'CLX', 'ABW', 'KAL', 'CKK', 'CZN', 'NCA', 'SIA', 'JADE'];
  if (cargoAirlines.some(c => flight.startsWith(c))) return 'cargo';

  // Cargo aircraft types
  const cargoTypes = ['B744', 'B748', 'B77F', 'B76F', 'B75F', 'MD11', 'A388'];
  if (type.includes('F') || cargoTypes.some(c => type.includes(c))) {
    if (flight.startsWith('FDX') || flight.startsWith('UPS') || flight.startsWith('DHL')) return 'cargo';
  }

  // Commercial - common airline prefixes
  const airlines = ['UAL', 'DAL', 'AAL', 'SWA', 'JBU', 'BAW', 'DLH', 'AFR', 'KLM', 'UAE', 'QTR', 'THY', 'SIA', 'ANA', 'JAL', 'KAL'];
  if (airlines.some(a => flight.startsWith(a))) return 'commercial';

  return 'general';
}

function isMilitary(ac: Aircraft): boolean {
  if (ac.dbFlags && (ac.dbFlags & 1)) return true;

  const flight = String(ac.flight || '').trim().toUpperCase();
  const milPatterns = [/^Q[A-Z]/, /^RCH/, /^ATLAS/, /^USAF/, /^USN/, /^USMC/, /^RAF/, /^NATO/, /^VKS/, /^RF-/, /^KNIFE/, /^NORTH/, /^REY/];
  if (milPatterns.some(p => p.test(flight))) return true;

  return false;
}

// ADSB API client - uses backend proxy
// API: https://api.adsb.lol
// License: ODbL 1.0 (Open Data)

export interface Aircraft {
  hex: string;
  flight?: string;
  lat?: number;
  lng?: number;
  alt_baro?: number;
  gs?: number;
  track?: number;
  type?: string;
  registration?: string;
  seen?: number;
  squawk?: string;
  category?: string;
  aircraftType?: 'military' | 'cargo' | 'commercial' | 'general' | 'helicopter';
  military?: boolean;
}

interface ADSBResponse {
  now: number;
  total: number;
  aircraft: Aircraft[];
  cached?: boolean;
  error?: string;
}

/**
 * Fetch aircraft data from our backend proxy
 */
export async function fetchAircraft(type: 'all' | 'military' = 'military'): Promise<Aircraft[]> {
  try {
    const response = await fetch(`/api/adsb?type=${type}`, {
      signal: AbortSignal.timeout(8000), // 8 second timeout (reduced from 20s)
    });

    if (!response.ok) {
      console.error('[ADSB] API error:', response.status);
      return [];
    }

    const data: ADSBResponse = await response.json();

    if (data.error) {
      console.warn('[ADSB] API warning:', data.error);
    }

    console.log(`[ADSB] Fetched ${data.aircraft.length} aircraft (cached: ${data.cached})`);
    return data.aircraft;
  } catch (error) {
    console.error('[ADSB] Error fetching aircraft:', error);
    return [];
  }
}

/**
 * Fetch military aircraft only
 */
export async function fetchMilitaryAircraft(): Promise<Aircraft[]> {
  return fetchAircraft('military');
}

/**
 * Get aircraft statistics
 */
export function getAircraftStats(aircraft: Aircraft[]) {
  const military = aircraft.filter(ac => ac.military || ac.aircraftType === 'military');
  const cargo = aircraft.filter(ac => ac.aircraftType === 'cargo');
  const commercial = aircraft.filter(ac => ac.aircraftType === 'commercial');
  const helicopter = aircraft.filter(ac => ac.aircraftType === 'helicopter');
  const highAltitude = aircraft.filter(ac => (ac.alt_baro || 0) > 30000);
  const fastMoving = aircraft.filter(ac => (ac.gs || 0) > 400);

  return {
    total: aircraft.length,
    military: military.length,
    cargo: cargo.length,
    commercial: commercial.length,
    helicopter: helicopter.length,
    highAltitude: highAltitude.length,
    fastMoving: fastMoving.length,
  };
}

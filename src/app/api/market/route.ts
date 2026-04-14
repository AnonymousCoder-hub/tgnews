import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Types
interface StockData {
  symbol: string;
  name: string;
  category: 'energy' | 'metals' | 'indices' | 'crypto';
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  previousClose: number;
  lastUpdated: string;
}

interface StockDataPoint {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

// Monitored symbols
const MONITORED_SYMBOLS = [
  { symbol: 'CL=F', name: 'Crude Oil WTI', category: 'energy' as const },
  { symbol: 'BZ=F', name: 'Brent Crude', category: 'energy' as const },
  { symbol: 'NG=F', name: 'Natural Gas', category: 'energy' as const },
  { symbol: 'GC=F', name: 'Gold', category: 'metals' as const },
  { symbol: 'SI=F', name: 'Silver', category: 'metals' as const },
  { symbol: 'HG=F', name: 'Copper', category: 'metals' as const },
  { symbol: '^GSPC', name: 'S&P 500', category: 'indices' as const },
  { symbol: '^DJI', name: 'Dow Jones', category: 'indices' as const },
  { symbol: '^IXIC', name: 'NASDAQ', category: 'indices' as const },
  { symbol: 'BTC-USD', name: 'Bitcoin', category: 'crypto' as const },
  { symbol: 'ETH-USD', name: 'Ethereum', category: 'crypto' as const },
];

// Rate limit: 2 minutes
const RATE_LIMIT_MS = 2 * 60 * 1000;

// Create Supabase client directly (no proxy)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('[MARKET] Missing Supabase credentials');
    return null;
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Fetch stock data from external API
async function fetchStockFromAPI(symbol: string): Promise<StockDataPoint[] | null> {
  const url = `https://yfin.vercel.app/stock/${encodeURIComponent(symbol)}?duration=5d`;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        'Accept': 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch {
    return null;
  }
}

// Calculate change
function calculateChange(data: StockDataPoint[]) {
  if (data.length < 2) {
    return { change: 0, changePercent: 0, previousClose: data[0]?.Close || 0 };
  }
  
  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];
  
  const change = today.Close - yesterday.Close;
  const changePercent = (change / yesterday.Close) * 100;
  
  return { change, changePercent, previousClose: yesterday.Close };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get('force') === 'true';
  
  try {
    // Get Supabase client
    const supabase = getSupabaseClient();
    
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Database not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.',
        data: [],
      }, { status: 500 });
    }
    
    // Check if market_data table exists by trying to select from it
    const { error: tableError } = await supabase
      .from('market_data')
      .select('symbol')
      .limit(1);
    
    if (tableError) {
      // Check if it's a "table doesn't exist" error
      if (tableError.message?.includes('does not exist') || 
          tableError.message?.includes('relation') ||
          tableError.code === '42P01') {
        return NextResponse.json({
          success: false,
          error: 'market_data table does not exist. Please create it in Supabase using the SQL in README.md',
          data: [],
        }, { status: 400 });
      }
      
      // Other error - log it but continue
      console.error('[MARKET] Supabase error:', tableError);
    }
    
    // Get last update time
    const { data: lastUpdateData } = await supabase
      .from('market_data')
      .select('lastupdated')
      .order('lastupdated', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const lastUpdate = lastUpdateData?.lastupdated ? new Date(lastUpdateData.lastupdated) : null;
    const shouldRefresh = force || !lastUpdate || (Date.now() - lastUpdate.getTime() >= RATE_LIMIT_MS);
    
    // Fetch fresh data if needed
    if (shouldRefresh) {
      console.log('[MARKET] Fetching fresh data from API...');
      
      for (const symbolInfo of MONITORED_SYMBOLS) {
        const rawData = await fetchStockFromAPI(symbolInfo.symbol);
        
        if (rawData && rawData.length > 0) {
          const latestData = rawData[rawData.length - 1];
          const { change, changePercent, previousClose } = calculateChange(rawData);
          
          await supabase
            .from('market_data')
            .upsert({
              symbol: symbolInfo.symbol,
              name: symbolInfo.name,
              category: symbolInfo.category,
              price: latestData.Close,
              change,
              changepercent: changePercent,
              open: latestData.Open,
              high: latestData.High,
              low: latestData.Low,
              volume: latestData.Volume,
              previousclose: previousClose,
              lastupdated: new Date().toISOString(),
            }, { onConflict: 'symbol' });
        }
        
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }
    
    // Get all data from database
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .order('category', { ascending: true });
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: `Database error: ${error.message}`,
        data: [],
      }, { status: 500 });
    }
    
    // Map data to proper format
    const marketData: StockData[] = (data || []).map((item: Record<string, unknown>) => ({
      symbol: String(item.symbol || ''),
      name: String(item.name || ''),
      category: String(item.category || 'indices') as 'energy' | 'metals' | 'indices' | 'crypto',
      price: Number(item.price) || 0,
      change: Number(item.change) || 0,
      changePercent: Number(item.changepercent) || 0,
      open: Number(item.open) || 0,
      high: Number(item.high) || 0,
      low: Number(item.low) || 0,
      volume: typeof item.volume === 'string' ? parseInt(item.volume, 10) : Number(item.volume) || 0,
      previousClose: Number(item.previousclose) || 0,
      lastUpdated: String(item.lastupdated || new Date().toISOString()),
    }));
    
    // Get final last update time
    const { data: finalLastUpdate } = await supabase
      .from('market_data')
      .select('lastupdated')
      .order('lastupdated', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    const lastUpdated = finalLastUpdate?.lastupdated || null;
    
    let nextUpdateIn = 0;
    if (lastUpdated) {
      const timeSinceUpdate = Date.now() - new Date(lastUpdated).getTime();
      nextUpdateIn = Math.max(0, Math.ceil((RATE_LIMIT_MS - timeSinceUpdate) / 1000));
    }
    
    return NextResponse.json({
      success: true,
      data: marketData,
      lastUpdated,
      nextUpdateIn,
    });
    
  } catch (error) {
    console.error('[MARKET API] Error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return NextResponse.json({
      success: false,
      error: `Internal error: ${errorMessage}`,
      data: [],
    }, { status: 500 });
  }
}

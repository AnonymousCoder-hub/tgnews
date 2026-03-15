import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

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

// Fetch stock data from external API
async function fetchStockFromAPI(symbol: string): Promise<StockDataPoint[] | null> {
  try {
    const response = await fetch(`https://yfin.vercel.app/stock/${symbol}?duration=5d`, {
      headers: { 'Accept': 'application/json' },
    });
    
    if (!response.ok) return null;
    
    return await response.json();
  } catch (error) {
    console.error(`[MARKET] Fetch error for ${symbol}:`, error);
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

// Get last update time
async function getLastUpdateTime(): Promise<Date | null> {
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('lastupdated')
      .order('lastupdated', { ascending: false })
      .limit(1)
      .single();
    
    if (error || !data) return null;
    return new Date(data.lastupdated);
  } catch {
    return null;
  }
}

// Save market data
async function saveMarketData(data: StockData) {
  try {
    await supabase
      .from('market_data')
      .upsert({
        symbol: data.symbol,
        name: data.name,
        category: data.category,
        price: data.price,
        change: data.change,
        changepercent: data.changePercent,
        open: data.open,
        high: data.high,
        low: data.low,
        volume: data.volume,
        previousclose: data.previousClose,
        lastupdated: data.lastUpdated,
      }, { onConflict: 'symbol' });
  } catch (error) {
    console.error(`[MARKET] Error saving ${data.symbol}:`, error);
  }
}

// Get all data from database
async function getMarketDataFromDB(): Promise<StockData[]> {
  try {
    const { data, error } = await supabase
      .from('market_data')
      .select('*')
      .order('category', { ascending: true });
    
    if (error || !data) return [];
    
    return data.map((item: Record<string, unknown>) => ({
      symbol: item.symbol as string,
      name: item.name as string,
      category: item.category as 'energy' | 'metals' | 'indices' | 'crypto',
      price: item.price as number,
      change: item.change as number,
      changePercent: item.changepercent as number,
      open: item.open as number,
      high: item.high as number,
      low: item.low as number,
      volume: item.volume as number,
      previousClose: item.previousclose as number,
      lastUpdated: item.lastupdated as string,
    }));
  } catch (error) {
    console.error('[MARKET] DB error:', error);
    return [];
  }
}

// Main function
export async function getMarketData(forceRefresh = false): Promise<{
  data: StockData[];
  lastUpdated: string | null;
  nextUpdateIn: number;
}> {
  const lastUpdate = await getLastUpdateTime();
  const shouldRefresh = forceRefresh || !lastUpdate || (Date.now() - lastUpdate.getTime() >= RATE_LIMIT_MS);
  
  if (shouldRefresh) {
    console.log('[MARKET] Fetching fresh data...');
    
    for (const symbolInfo of MONITORED_SYMBOLS) {
      const rawData = await fetchStockFromAPI(symbolInfo.symbol);
      
      if (rawData && rawData.length > 0) {
        const latestData = rawData[rawData.length - 1];
        const { change, changePercent, previousClose } = calculateChange(rawData);
        
        const stockData: StockData = {
          symbol: symbolInfo.symbol,
          name: symbolInfo.name,
          category: symbolInfo.category,
          price: latestData.Close,
          change,
          changePercent,
          open: latestData.Open,
          high: latestData.High,
          low: latestData.Low,
          volume: latestData.Volume,
          previousClose,
          lastUpdated: new Date().toISOString(),
        };
        
        await saveMarketData(stockData);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  const allData = await getMarketDataFromDB();
  const lastUpdateTime = await getLastUpdateTime();
  
  let nextUpdateIn = 0;
  if (lastUpdateTime) {
    const timeSinceUpdate = Date.now() - lastUpdateTime.getTime();
    nextUpdateIn = Math.max(0, Math.ceil((RATE_LIMIT_MS - timeSinceUpdate) / 1000));
  }
  
  return {
    data: allData,
    lastUpdated: lastUpdateTime?.toISOString() || null,
    nextUpdateIn,
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    
    const result = await getMarketData(force);
    
    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('[MARKET API] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch market data',
      data: [],
    }, { status: 500 });
  }
}

import { supabase } from './supabase';

// Stock/Commodity data types
export interface StockData {
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

export interface StockDataPoint {
  Date: string;
  Open: number;
  High: number;
  Low: number;
  Close: number;
  Volume: number;
}

// Important commodities and stocks to monitor
export const MONITORED_SYMBOLS = [
  // Energy
  { symbol: 'CL=F', name: 'Crude Oil WTI', category: 'energy' as const, icon: '🛢️' },
  { symbol: 'BZ=F', name: 'Brent Crude', category: 'energy' as const, icon: '⛽' },
  { symbol: 'NG=F', name: 'Natural Gas', category: 'energy' as const, icon: '🔥' },
  // Metals
  { symbol: 'GC=F', name: 'Gold', category: 'metals' as const, icon: '🥇' },
  { symbol: 'SI=F', name: 'Silver', category: 'metals' as const, icon: '🥈' },
  { symbol: 'HG=F', name: 'Copper', category: 'metals' as const, icon: '🔶' },
  // Indices
  { symbol: '^GSPC', name: 'S&P 500', category: 'indices' as const, icon: '📈' },
  { symbol: '^DJI', name: 'Dow Jones', category: 'indices' as const, icon: '📊' },
  { symbol: '^IXIC', name: 'NASDAQ', category: 'indices' as const, icon: '💻' },
  // Crypto (via Yahoo)
  { symbol: 'BTC-USD', name: 'Bitcoin', category: 'crypto' as const, icon: '₿' },
  { symbol: 'ETH-USD', name: 'Ethereum', category: 'crypto' as const, icon: 'Ξ' },
];

// Rate limit: 2 minutes
const RATE_LIMIT_MS = 2 * 60 * 1000;

// Fetch stock data from API
async function fetchStockFromAPI(symbol: string): Promise<StockDataPoint[] | null> {
  try {
    const response = await fetch(`https://yfin.vercel.app/stock/${symbol}?duration=5d`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      console.error(`[MARKET] API error for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data: StockDataPoint[] = await response.json();
    return data;
  } catch (error) {
    console.error(`[MARKET] Fetch error for ${symbol}:`, error);
    return null;
  }
}

// Calculate change from previous day
function calculateChange(data: StockDataPoint[]): { change: number; changePercent: number; previousClose: number } {
  if (data.length < 2) {
    return { change: 0, changePercent: 0, previousClose: data[0]?.Close || 0 };
  }
  
  const today = data[data.length - 1];
  const yesterday = data[data.length - 2];
  
  const change = today.Close - yesterday.Close;
  const changePercent = (change / yesterday.Close) * 100;
  
  return {
    change,
    changePercent,
    previousClose: yesterday.Close,
  };
}

// Get last update time from database
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

// Check if we should fetch new data (2-minute rate limit)
function shouldFetchNewData(lastUpdate: Date | null): boolean {
  if (!lastUpdate) return true;
  return Date.now() - lastUpdate.getTime() >= RATE_LIMIT_MS;
}

// Save market data to database
async function saveMarketData(data: StockData): Promise<void> {
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

// Get all market data from database
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
    console.error('[MARKET] Error fetching from DB:', error);
    return [];
  }
}

// Main function to get market data
export async function getMarketData(forceRefresh = false): Promise<{
  data: StockData[];
  lastUpdated: string | null;
  nextUpdateIn: number;
}> {
  const lastUpdate = await getLastUpdateTime();
  
  // Check if we need to fetch new data
  if (forceRefresh || shouldFetchNewData(lastUpdate)) {
    console.log('[MARKET] Fetching fresh data from API...');
    
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
      
      // Small delay between requests to be nice to the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } else {
    console.log('[MARKET] Using cached data');
  }
  
  // Get all data from database
  const allData = await getMarketDataFromDB();
  
  // Calculate time until next update is allowed
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

// Get category color
export function getCategoryColor(category: string): string {
  switch (category) {
    case 'energy': return 'from-amber-500 to-orange-600';
    case 'metals': return 'from-yellow-500 to-amber-600';
    case 'indices': return 'from-blue-500 to-indigo-600';
    case 'crypto': return 'from-purple-500 to-pink-600';
    default: return 'from-gray-500 to-gray-600';
  }
}

// Get category badge color
export function getCategoryBadgeColor(category: string): string {
  switch (category) {
    case 'energy': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
    case 'metals': return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20';
    case 'indices': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
    case 'crypto': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
    default: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
  }
}

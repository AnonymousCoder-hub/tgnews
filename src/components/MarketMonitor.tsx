'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Clock, 
  Loader2,
  DollarSign,
  Fuel,
  Coins,
  BarChart3,
  X,
  Zap,
  AlertTriangle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface MarketData {
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

interface MarketMonitorProps {
  onClose?: () => void;
}

// Category config with icons and colors
const CATEGORY_CONFIG: Record<string, { icon: React.ReactNode; label: string; gradient: string; bgGradient: string }> = {
  energy: { 
    icon: <Fuel className="h-4 w-4" />, 
    label: 'Energy',
    gradient: 'from-amber-400 to-orange-500',
    bgGradient: 'from-amber-500/10 to-orange-500/5'
  },
  metals: { 
    icon: <Coins className="h-4 w-4" />, 
    label: 'Precious Metals',
    gradient: 'from-yellow-400 to-amber-500',
    bgGradient: 'from-yellow-500/10 to-amber-500/5'
  },
  indices: { 
    icon: <BarChart3 className="h-4 w-4" />, 
    label: 'Market Indices',
    gradient: 'from-blue-400 to-indigo-500',
    bgGradient: 'from-blue-500/10 to-indigo-500/5'
  },
  crypto: { 
    icon: <DollarSign className="h-4 w-4" />, 
    label: 'Cryptocurrency',
    gradient: 'from-purple-400 to-pink-500',
    bgGradient: 'from-purple-500/10 to-pink-500/5'
  },
};

// Format price based on value
function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (price >= 1000) return price.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (price >= 1) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return price.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
}

// Format large numbers
function formatVolume(num: number): string {
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toString();
}

// Format time ago
function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export default function MarketMonitor({ onClose }: MarketMonitorProps) {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [nextUpdateIn, setNextUpdateIn] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Fetch market data
  const fetchMarketData = async (force = false) => {
    if (refreshing) return;
    
    try {
      setRefreshing(true);
      setError(null);
      
      const response = await fetch(`/api/market${force ? '?force=true' : ''}`);
      const result = await response.json();
      
      if (result.success) {
        setMarketData(result.data);
        setLastUpdated(result.lastUpdated);
        setNextUpdateIn(result.nextUpdateIn);
      } else {
        setError(result.error || 'Failed to fetch market data');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchMarketData();
  }, []);

  // Countdown timer for next update
  useEffect(() => {
    if (nextUpdateIn <= 0) return;
    
    const interval = setInterval(() => {
      setNextUpdateIn(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(interval);
  }, [nextUpdateIn]);

  // Group data by category
  const groupedData = marketData.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, MarketData[]>);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      {/* Header - Simple with sleek SVG */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Sleek SVG Icon */}
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-emerald-500">
            <path d="M3 3V21H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 14L11 10L15 14L21 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="21" cy="8" r="2" fill="currentColor"/>
          </svg>
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Market Monitor
            </h2>
            <p className="text-xs text-muted-foreground">Commodity & market prices</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Last updated badge */}
          {lastUpdated && (
            <Badge variant="outline" className="text-[10px] font-mono gap-1.5 px-2">
              <Clock className="h-3 w-3" />
              {formatTimeAgo(lastUpdated)}
            </Badge>
          )}
          
          {/* Refresh button with countdown */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMarketData(true)}
            disabled={refreshing || nextUpdateIn > 0}
            className="gap-2"
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            {nextUpdateIn > 0 ? (
              <span className="text-xs">{Math.floor(nextUpdateIn / 60)}:{(nextUpdateIn % 60).toString().padStart(2, '0')}</span>
            ) : (
              <span className="hidden sm:inline">Refresh</span>
            )}
          </Button>
          
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose} className="gap-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950">
              <X className="h-4 w-4" />
              <span className="hidden sm:inline">Close</span>
            </Button>
          )}
        </div>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <span className="text-sm text-red-700 dark:text-red-300">{error}</span>
            <Button variant="outline" size="sm" onClick={() => fetchMarketData(true)} className="ml-auto">
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 animate-pulse" />
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-muted-foreground mt-4 animate-pulse">Loading market data...</p>
        </div>
      ) : (
        /* Market Data Grid */
        <div className="space-y-6">
          {Object.entries(groupedData).map(([category, items]) => (
            <div key={category} className="space-y-3">
              {/* Category Header */}
              <div className="flex items-center gap-2 px-1">
                <div className={cn(
                  "p-1.5 rounded-lg bg-gradient-to-br",
                  CATEGORY_CONFIG[category]?.bgGradient || 'from-gray-500/10 to-gray-500/5'
                )}>
                  {CATEGORY_CONFIG[category]?.icon || <BarChart3 className="h-4 w-4" />}
                </div>
                <span className="text-sm font-semibold text-foreground">
                  {CATEGORY_CONFIG[category]?.label || category}
                </span>
                <Badge variant="outline" className="text-[10px] font-mono">
                  {items.length} assets
                </Badge>
              </div>
              
              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((item) => {
                  const isPositive = item.change >= 0;
                  
                  return (
                    <motion.div
                      key={item.symbol}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className={cn(
                        "group relative overflow-hidden hover:shadow-xl transition-all duration-300 border-border/50 hover:border-border cursor-pointer",
                        "bg-gradient-to-br from-card to-muted/20"
                      )}>
                        {/* Animated gradient background on hover */}
                        <div className={cn(
                          "absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500",
                          isPositive 
                            ? "bg-gradient-to-br from-emerald-500/5 to-green-500/10" 
                            : "bg-gradient-to-br from-red-500/5 to-rose-500/10"
                        )} />
                        
                        <CardContent className="p-4 relative">
                          {/* Top row: Symbol & Change */}
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-muted-foreground font-mono">
                                  {item.symbol.replace('=F', '').replace('^', '').replace('-USD', '')}
                                </span>
                                {isPositive ? (
                                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                                )}
                              </div>
                              <h3 className="font-semibold text-sm mt-0.5">{item.name}</h3>
                            </div>
                            
                            {/* Change badge */}
                            <div className={cn(
                              "flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold",
                              isPositive 
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                : "bg-red-500/10 text-red-600 dark:text-red-400"
                            )}>
                              {isPositive ? '+' : ''}{item.changePercent.toFixed(2)}%
                            </div>
                          </div>
                          
                          {/* Price */}
                          <div className="mb-3">
                            <span className={cn(
                              "text-2xl font-bold tracking-tight",
                              isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                            )}>
                              ${formatPrice(item.price)}
                            </span>
                            <span className={cn(
                              "text-xs ml-2",
                              isPositive ? "text-emerald-500" : "text-red-500"
                            )}>
                              {isPositive ? '+' : ''}{item.change.toFixed(2)}
                            </span>
                          </div>
                          
                          {/* Stats row */}
                          <div className="grid grid-cols-3 gap-2 text-[10px]">
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Open</span>
                              <span className="font-mono font-medium">${formatPrice(item.open)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">High</span>
                              <span className="font-mono font-medium text-emerald-600">${formatPrice(item.high)}</span>
                            </div>
                            <div className="flex flex-col">
                              <span className="text-muted-foreground">Low</span>
                              <span className="font-mono font-medium text-red-600">${formatPrice(item.low)}</span>
                            </div>
                          </div>
                          
                          {/* Volume bar at bottom */}
                          {item.volume > 0 && (
                            <div className="mt-3 pt-2 border-t border-border/30">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">Volume</span>
                                <span className="font-mono font-medium">{formatVolume(item.volume)}</span>
                              </div>
                            </div>
                          )}
                          
                          {/* Sparkle effect on hover */}
                          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Zap className="h-4 w-4 text-yellow-500 animate-pulse" />
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

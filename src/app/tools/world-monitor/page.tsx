"use client";

import { useState, useEffect, useCallback } from "react";
import { Globe3D, DEFAULT_CONFLICT_MARKERS, parseConflictMarkersFromMessages, ConflictMarker, AircraftData, MarketData } from "@/components/world-monitor/Globe3D";
import { fetchMilitaryAircraft, Aircraft } from "@/lib/adsb-api";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  Plane,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Activity,
  Globe2,
  RefreshCw,
  X,
  Clock,
  Zap,
  ArrowLeft,
  Radio,
} from "lucide-react";

// ============================================
// Fallback Events (used only when API is unavailable)
// ============================================

const FALLBACK_EVENTS = [
  { id: "1", title: "Red Sea Tensions", description: "Shipping disruptions continue", severity: "high" as const, timestamp: "2h ago", location: "Red Sea" },
  { id: "2", title: "Gaza Negotiations", description: "Ceasefire talks resume", severity: "medium" as const, timestamp: "4h ago", location: "Doha" },
  { id: "3", title: "Eastern Front Activity", description: "Military movements reported", severity: "high" as const, timestamp: "1h ago", location: "Donetsk" },
];

// Severity keywords for parsing Telegram messages into events
const EVENT_SEVERITY_KEYWORDS = {
  high: ["strike", "explosion", "attack", "bombing", "missile", "airstrike", "killed", "destroyed", "invasion", "offensive", "shelling", "war", "crash", "shot down"],
  medium: ["tension", "escalat", "deploy", "military", "troop", "border", "skirmish", "clash", "alert", "warning", "fire", "evacuat"],
};

// ============================================
// Main Component
// ============================================

export default function WorldMonitorPage() {
  const [aircraft, setAircraft] = useState<Aircraft[]>([]);
  const [loading, setLoading] = useState(false); // Start false - show static data first
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [tensionIndex, setTensionIndex] = useState(67.4);
  const [nextRefresh, setNextRefresh] = useState(15); // Countdown in seconds (reduced from 30s)
  const [conflictMarkers, setConflictMarkers] = useState<ConflictMarker[]>(DEFAULT_CONFLICT_MARKERS);
  const [dynamicEvents, setDynamicEvents] = useState(FALLBACK_EVENTS);

  // Mobile panel state
  const [activePanel, setActivePanel] = useState<'none' | 'aircraft' | 'events' | 'markets'>('none');

  // Fetch aircraft data in background
  const fetchAircraftData = useCallback(async () => {
    try {
      const military = await fetchMilitaryAircraft();
      setAircraft(military);
      setLastUpdate(new Date());
      setNextRefresh(15); // Reset countdown (reduced from 30s)
      // Update tension based on number of military aircraft
      setTensionIndex(Math.min(95, 50 + military.length * 0.5));
    } catch (error) {
      console.error('[WorldMonitor] Error fetching aircraft:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch markets
  const fetchMarkets = useCallback(async () => {
    try {
      const res = await fetch('/api/market');
      const data = await res.json();
      if (data.success && data.data) {
        setMarkets(data.data.map((m: any) => ({
          symbol: m.symbol,
          name: m.name,
          price: m.price,
          change: m.change,
          changePercent: m.changePercent,
        })));
      }
    } catch (e) {
      console.error('[WorldMonitor] Error fetching markets:', e);
    }
  }, []);

  // Fetch Telegram data for dynamic events and conflict markers
  const fetchTelegramData = useCallback(async () => {
    try {
      const res = await fetch('/api/telegram?limit=10', {
        headers: { 'x-api-secret': 'newstel-internal-2024' }
      });
      const data = await res.json();
      
      if (data.success && data.data?.messages?.length > 0) {
        const messages = data.data.messages;
        
        // Parse conflict markers from messages
        const markers = parseConflictMarkersFromMessages(messages);
        if (markers.length > 0) {
          // Merge dynamic markers with defaults (dynamic ones take priority)
          const dynamicIds = new Set(markers.map(m => m.name.toLowerCase()));
          const merged = [...markers, ...DEFAULT_CONFLICT_MARKERS.filter(m => !dynamicIds.has(m.name.toLowerCase()))];
          setConflictMarkers(merged);
        }
        
        // Parse messages into events
        const events = messages.slice(0, 10).map((msg: any, i: number) => {
          const text = (msg.text || msg.translation || '').toLowerCase();
          const severity = EVENT_SEVERITY_KEYWORDS.high.some(k => text.includes(k)) ? 'high' as const
            : EVENT_SEVERITY_KEYWORDS.medium.some(k => text.includes(k)) ? 'medium' as const
            : 'low' as const;
          
          const timeDiff = msg.timestamp ? Date.now() - new Date(msg.timestamp).getTime() : 0;
          const minsAgo = Math.floor(timeDiff / 60000);
          const timeStr = minsAgo < 1 ? 'now' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`;
          
          // Extract a short title from the message
          const fullText = msg.text || msg.translation || '';
          const title = fullText.length > 60 
            ? fullText.substring(0, 60).split(' ').slice(0, -1).join(' ') + '...'
            : fullText;
          
          return {
            id: msg.id || String(i),
            title,
            description: msg.channelName || 'News Update',
            severity,
            timestamp: timeStr,
            location: msg.channelName || 'Global',
          };
        });
        
        if (events.length > 0) {
          setDynamicEvents(events);
        }
      }
    } catch (e) {
      console.error('[WorldMonitor] Error fetching telegram data:', e);
    }
  }, []);
  
  // Countdown timer
  useEffect(() => {
    if (showIntro) return;
    const timer = setInterval(() => {
      setNextRefresh(prev => {
        if (prev <= 1) return 15;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showIntro]);

  // Initial load - fetch in background, don't block UI
  useEffect(() => {
    // Load data in background after intro
    if (!showIntro) {
      fetchAircraftData();
      fetchMarkets();
      fetchTelegramData();
      
      // Refresh aircraft every 15 seconds for real-time updates
      const aircraftInterval = setInterval(fetchAircraftData, 15000);
      // Refresh markets every 2 minutes
      const marketInterval = setInterval(fetchMarkets, 120000);
      // Refresh Telegram data every 60 seconds
      const telegramInterval = setInterval(fetchTelegramData, 60000);
      
      return () => {
        clearInterval(aircraftInterval);
        clearInterval(marketInterval);
        clearInterval(telegramInterval);
      };
    }
  }, [showIntro, fetchAircraftData, fetchMarkets, fetchTelegramData]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAircraftData();
    fetchMarkets();
    fetchTelegramData();
  };

  // Intro screen
  if (showIntro) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-6"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/20 flex items-center justify-center">
            <Globe2 className="w-10 h-10 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">World Monitor</h1>
          <p className="text-zinc-400 text-sm mb-8 max-w-xs mx-auto">
            Real-time global intelligence: conflicts, military aircraft, and shipping
          </p>
          <button
            onClick={() => setShowIntro(false)}
            className="px-8 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 font-medium rounded-lg transition-all"
          >
            Enter Monitor
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-black/90 backdrop-blur-xl border-b border-white/5 z-30">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Back Button */}
            <Link 
              href="/"
              className="w-9 h-9 rounded-lg border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 flex items-center justify-center transition-all"
            >
              <ArrowLeft className="w-4 h-4 text-zinc-400" />
            </Link>
            
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Globe2 className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-base font-semibold text-white">World Monitor</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Live indicator with pulse */}
            <div className="flex items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-full">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-emerald-500 animate-ping opacity-50" />
              </div>
              <span className="text-[11px] text-emerald-400 font-medium">LIVE</span>
              <Radio className="w-3 h-3 text-emerald-400" />
            </div>

            <div className="hidden md:flex items-center gap-1.5 text-xs text-zinc-500">
              <Clock className="w-3.5 h-3.5" />
              <span className="font-mono">{lastUpdate ? lastUpdate.toLocaleTimeString() : '--:--:--'}</span>
            </div>

            {/* Auto-refresh countdown */}
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-white/5 rounded-full text-[10px] text-zinc-500">
              <span className="font-mono">{nextRefresh}s</span>
            </div>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-9 h-9 rounded-lg border border-white/5 hover:border-blue-500/30 hover:bg-blue-500/5 flex items-center justify-center transition-all"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : 'text-zinc-400'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Globe Container */}
      <div className="fixed inset-0 pt-14">
        <Globe3D aircraft={aircraft} conflictMarkers={conflictMarkers} />
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden">
        <div className="flex items-center justify-around bg-black/90 backdrop-blur-xl border-t border-white/5 px-4 py-2">
          {[
            { id: 'aircraft', icon: Plane, label: 'Aircraft', color: 'blue' },
            { id: 'events', icon: AlertTriangle, label: 'Events', color: 'red' },
            { id: 'markets', icon: Activity, label: 'Markets', color: 'emerald' },
          ].map(({ id, icon: Icon, label }) => (
            <button
              key={id}
              onClick={() => setActivePanel(activePanel === id ? 'none' : id as typeof activePanel)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all ${
                activePanel === id ? 'text-blue-400' : 'text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Desktop Side Panels */}
      <div className="hidden md:block fixed top-28 left-0 bottom-0 w-72 z-10 overflow-y-auto p-3 space-y-3 pointer-events-none">
        <div className="pointer-events-auto space-y-3">
          {/* Aircraft */}
          <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-medium text-zinc-300">Military Aircraft</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded-full">{aircraft.length}</span>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {aircraft.length > 0 ? (
                <div className="divide-y divide-white/5">
                  {aircraft.slice(0, 6).map((ac) => (
                    <div key={ac.hex} className="px-4 py-2.5 hover:bg-white/5 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">✈️ {ac.flight || ac.registration || 'N/A'}</span>
                        <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">MIL</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                        <span>{ac.type || 'Unknown'}</span>
                        {ac.alt_baro && <span>• {ac.alt_baro.toLocaleString()} ft</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-xs text-zinc-500">
                  {loading ? 'Loading...' : 'Click refresh to load aircraft'}
                </div>
              )}
            </div>
          </div>

          {/* Events */}
          <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-xs font-medium text-zinc-300">Recent Events</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 bg-red-500/10 text-red-400 rounded-full">{dynamicEvents.length}</span>
            </div>
            <div className="divide-y divide-white/5 max-h-40 overflow-y-auto">
              {dynamicEvents.map((event) => (
                <div key={event.id} className="px-4 py-2.5 hover:bg-white/5 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-white">{event.title}</p>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                      event.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                      event.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>
                      {event.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-600">
                    <span>{event.location}</span>
                    <span>•</span>
                    <span>{event.timestamp}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Right Panel - Tension Index */}
      <div className="hidden md:block fixed top-28 right-0 bottom-0 w-72 z-10 overflow-y-auto p-3 pointer-events-none">
        <div className="pointer-events-auto space-y-3">
          {/* Tension Index */}
          <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/5 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-medium text-zinc-300">Global Tension</span>
              </div>
              <span className={`text-lg font-bold ${
                tensionIndex > 70 ? 'text-red-400' : tensionIndex > 50 ? 'text-amber-400' : 'text-emerald-400'
              }`}>{tensionIndex.toFixed(1)}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 via-amber-500 to-red-500" style={{ width: `${tensionIndex}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-zinc-600 mt-1.5">
              <span>Stable</span>
              <span>Elevated</span>
              <span>Critical</span>
            </div>
          </div>

          {/* Stats */}
          <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/5 p-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-red-400">{conflictMarkers.length}</p>
                <p className="text-[10px] text-zinc-500 mt-1">Conflicts</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-cyan-400">{aircraft.filter(a => a.lat && a.lng).length}</p>
                <p className="text-[10px] text-zinc-500 mt-1">Aircraft</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-400">{dynamicEvents.length}</p>
                <p className="text-[10px] text-zinc-500 mt-1">Events</p>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="px-3 py-2 text-[10px] text-zinc-600 flex items-start gap-2">
            <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
            <p>Data may not be accurate. Verify from multiple sources.</p>
          </div>
        </div>
      </div>

      {/* Mobile Slide-up Panel */}
      <AnimatePresence>
        {activePanel !== 'none' && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-30 md:hidden"
          >
            <div className="bg-black/95 backdrop-blur-xl border-t border-white/10 rounded-t-2xl max-h-[60vh] overflow-hidden">
              <div className="flex justify-center py-2">
                <div className="w-10 h-1 bg-zinc-700 rounded-full" />
              </div>
              <div className="px-4 py-2 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {activePanel === 'aircraft' && <Plane className="w-4 h-4 text-blue-400" />}
                  {activePanel === 'events' && <AlertTriangle className="w-4 h-4 text-red-400" />}
                  {activePanel === 'markets' && <Activity className="w-4 h-4 text-emerald-400" />}
                  <span className="text-sm font-medium text-white capitalize">{activePanel}</span>
                </div>
                <button onClick={() => setActivePanel('none')} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                  <X className="w-4 h-4 text-zinc-400" />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(60vh-60px)] pb-20">
                {activePanel === 'aircraft' && (
                  <div className="divide-y divide-white/5">
                    {aircraft.length > 0 ? (
                      aircraft.slice(0, 15).map((ac) => (
                        <div key={ac.hex} className="px-4 py-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-white">✈️ {ac.flight || ac.registration || 'N/A'}</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">MILITARY</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                            <span>{ac.type || 'Unknown'}</span>
                            {ac.alt_baro && <span>• {ac.alt_baro.toLocaleString()} ft</span>}
                            {ac.gs && <span>• {ac.gs} kts</span>}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-sm text-zinc-500">
                        {loading ? 'Loading...' : 'Tap refresh to load aircraft'}
                      </div>
                    )}
                  </div>
                )}

                {activePanel === 'events' && (
                  <div className="divide-y divide-white/5">
                    {dynamicEvents.map((event) => (
                      <div key={event.id} className="px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm text-white">{event.title}</p>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                            event.severity === 'high' ? 'bg-red-500/10 text-red-400' :
                            event.severity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                            'bg-emerald-500/10 text-emerald-400'
                          }`}>
                            {event.severity.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{event.description}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-600">
                          <span>{event.location}</span>
                          <span>•</span>
                          <span>{event.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activePanel === 'markets' && (
                  <div className="divide-y divide-white/5">
                    {markets.length > 0 ? markets.map((market) => {
                      const isPositive = market.changePercent >= 0;
                      return (
                        <div key={market.symbol} className="px-4 py-3 flex items-center justify-between">
                          <span className="text-sm text-zinc-300">{market.name}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{market.price.toLocaleString()}</span>
                            <span className={`text-xs flex items-center ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                              {Math.abs(market.changePercent).toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="p-8 text-center text-sm text-zinc-500">Loading markets...</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

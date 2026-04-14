"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plane, AlertTriangle, Eye, EyeOff, X, Zap, TrendingUp, TrendingDown, Info } from "lucide-react";

// ============================================
// Types
// ============================================

export interface ConflictMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  severity: "high" | "medium" | "low";
  country: string;
  description: string;
  timestamp: string;
  flag?: string;
}

export interface AircraftData {
  hex: string;
  flight?: string;
  lat?: number;
  lng?: number;
  alt_baro?: number;
  gs?: number;
  track?: number;
  type?: string;
  registration?: string;
  military?: boolean;
  squawk?: string;
  seen?: number;
  aircraftType?: string;
}

export interface MarketData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

// ============================================
// Static Data (instantly available)
// ============================================

// Default conflict markers used as fallback when Telegram data is unavailable
export const DEFAULT_CONFLICT_MARKERS: ConflictMarker[] = [
  { id: "1", name: "Gaza", lat: 31.3547, lng: 34.3088, severity: "high", country: "Palestine", description: "Ongoing military operations in Gaza Strip", timestamp: "2h ago", flag: "🇵🇸" },
  { id: "2", name: "Ukraine", lat: 50.4501, lng: 30.5234, severity: "high", country: "Ukraine", description: "Continued hostilities along multiple fronts", timestamp: "30m ago", flag: "🇺🇦" },
  { id: "3", name: "Red Sea", lat: 15.5527, lng: 41.5333, severity: "high", country: "Yemen", description: "Houthi attacks on commercial shipping", timestamp: "1h ago", flag: "🇾🇪" },
  { id: "4", name: "Syria", lat: 33.5138, lng: 36.2765, severity: "medium", country: "Syria", description: "Regional instability and airstrikes", timestamp: "4h ago", flag: "🇸🇾" },
  { id: "5", name: "Myanmar", lat: 21.9162, lng: 95.9560, severity: "medium", country: "Myanmar", description: "Civil conflict ongoing", timestamp: "6h ago", flag: "🇲🇲" },
  { id: "6", name: "Sudan", lat: 15.5007, lng: 32.5599, severity: "high", country: "Sudan", description: "Armed conflict between military factions", timestamp: "3h ago", flag: "🇸🇩" },
  { id: "7", name: "Somalia", lat: 2.0469, lng: 45.3182, severity: "medium", country: "Somalia", description: "Insurgency and piracy concerns", timestamp: "5h ago", flag: "🇸🇴" },
  { id: "8", name: "DR Congo", lat: -4.4419, lng: 15.2663, severity: "high", country: "DRC", description: "Armed groups active in eastern regions", timestamp: "2h ago", flag: "🇨🇩" },
  { id: "9", name: "S. China Sea", lat: 10.0, lng: 115.0, severity: "medium", country: "International", description: "Territorial disputes and naval tensions", timestamp: "8h ago", flag: "🌊" },
  { id: "10", name: "Kashmir", lat: 34.0, lng: 76.0, severity: "medium", country: "India/Pakistan", description: "Border tensions and skirmishes", timestamp: "12h ago", flag: "🇮🇳" },
  { id: "11", name: "Iran", lat: 35.6892, lng: 51.3890, severity: "high", country: "Iran", description: "Escalating regional tensions", timestamp: "1h ago", flag: "🇮🇷" },
  { id: "12", name: "Libya", lat: 26.3351, lng: 17.2283, severity: "medium", country: "Libya", description: "Political instability and armed groups", timestamp: "7h ago", flag: "🇱🇾" },
];

// Dynamic conflict markers populated from Telegram messages
export const CONFLICT_MARKERS: ConflictMarker[] = [...DEFAULT_CONFLICT_MARKERS];

// Location keyword mapping for extracting conflict markers from Telegram messages
const LOCATION_KEYWORDS: Record<string, { lat: number; lng: number; country: string; flag: string }> = {
  gaza: { lat: 31.3547, lng: 34.3088, country: "Palestine", flag: "🇵🇸" },
  "khan younis": { lat: 31.3439, lng: 34.3033, country: "Palestine", flag: "🇵🇸" },
  rafah: { lat: 31.2833, lng: 34.2333, country: "Palestine", flag: "🇵🇸" },
  "west bank": { lat: 31.95, lng: 35.2, country: "Palestine", flag: "🇵🇸" },
  ukraine: { lat: 50.4501, lng: 30.5234, country: "Ukraine", flag: "🇺🇦" },
  kyiv: { lat: 50.4501, lng: 30.5234, country: "Ukraine", flag: "🇺🇦" },
  donetsk: { lat: 48.0, lng: 37.8, country: "Ukraine", flag: "🇺🇦" },
  donbas: { lat: 48.5, lng: 38.0, country: "Ukraine", flag: "🇺🇦" },
  kharkiv: { lat: 49.99, lng: 36.23, country: "Ukraine", flag: "🇺🇦" },
  crimea: { lat: 45.0, lng: 34.0, country: "Ukraine", flag: "🇺🇦" },
  "red sea": { lat: 15.5527, lng: 41.5333, country: "Yemen", flag: "🇾🇪" },
  yemen: { lat: 15.5527, lng: 48.5168, country: "Yemen", flag: "🇾🇪" },
  houthis: { lat: 15.5527, lng: 44.0, country: "Yemen", flag: "🇾🇪" },
  houthi: { lat: 15.5527, lng: 44.0, country: "Yemen", flag: "🇾🇪" },
  syria: { lat: 33.5138, lng: 36.2765, country: "Syria", flag: "🇸🇾" },
  damascus: { lat: 33.5138, lng: 36.2765, country: "Syria", flag: "🇸🇾" },
  aleppo: { lat: 36.2, lng: 37.16, country: "Syria", flag: "🇸🇾" },
  iran: { lat: 35.6892, lng: 51.389, country: "Iran", flag: "🇮🇷" },
  tehran: { lat: 35.6892, lng: 51.389, country: "Iran", flag: "🇮🇷" },
  iraq: { lat: 33.3128, lng: 44.3615, country: "Iraq", flag: "🇮🇶" },
  baghdad: { lat: 33.3128, lng: 44.3615, country: "Iraq", flag: "🇮🇶" },
  lebanon: { lat: 33.8547, lng: 35.8623, country: "Lebanon", flag: "🇱🇧" },
  beirut: { lat: 33.8547, lng: 35.8623, country: "Lebanon", flag: "🇱🇧" },
  israel: { lat: 31.7683, lng: 35.2137, country: "Israel", flag: "🇮🇱" },
  sudan: { lat: 15.5007, lng: 32.5599, country: "Sudan", flag: "🇸🇩" },
  myanmar: { lat: 21.9162, lng: 95.956, country: "Myanmar", flag: "🇲🇲" },
  somalia: { lat: 2.0469, lng: 45.3182, country: "Somalia", flag: "🇸🇴" },
  congo: { lat: -4.4419, lng: 15.2663, country: "DRC", flag: "🇨🇩" },
  libya: { lat: 26.3351, lng: 17.2283, country: "Libya", flag: "🇱🇾" },
  kashmir: { lat: 34.0, lng: 76.0, country: "India/Pakistan", flag: "🇮🇳" },
  "south china sea": { lat: 10.0, lng: 115.0, country: "International", flag: "🌊" },
  taiwan: { lat: 23.7, lng: 120.9, country: "Taiwan", flag: "🇹🇼" },
  korea: { lat: 38.0, lng: 127.5, country: "Korea", flag: "🇰🇷" },
  pakistan: { lat: 30.3753, lng: 69.3451, country: "Pakistan", flag: "🇵🇰" },
  afghanistan: { lat: 33.9391, lng: 67.71, country: "Afghanistan", flag: "🇦🇫" },
  russia: { lat: 55.7558, lng: 37.6173, country: "Russia", flag: "🇷🇺" },
};

// High-severity keywords for determining conflict marker severity
const HIGH_SEVERITY_KEYWORDS = ["strike", "explosion", "attack", "bombing", "missile", "airstrike", "killed", "destroyed", "invasion", "offensive", "shelling", "ceasefire", "war"];
const MEDIUM_SEVERITY_KEYWORDS = ["tension", "escalat", "deploy", "military", "troop", "border", "skirmish", "clash", "alert", "warning"];

/**
 * Parse Telegram messages and extract dynamic conflict markers
 */
export function parseConflictMarkersFromMessages(messages: any[]): ConflictMarker[] {
  const markerMap = new Map<string, ConflictMarker>();

  for (const msg of messages) {
    const text = (msg.text || msg.translation || '').toLowerCase();
    if (!text) continue;

    for (const [keyword, location] of Object.entries(LOCATION_KEYWORDS)) {
      if (text.includes(keyword)) {
        const existing = markerMap.get(keyword);
        const severity = HIGH_SEVERITY_KEYWORDS.some(k => text.includes(k)) ? "high"
          : MEDIUM_SEVERITY_KEYWORDS.some(k => text.includes(k)) ? "medium"
          : "low";

        // Keep the highest severity and most recent timestamp
        if (!existing || severity === "high" || (severity === "medium" && existing.severity === "low")) {
          const timeDiff = msg.timestamp ? Date.now() - new Date(msg.timestamp).getTime() : 0;
          const minsAgo = Math.floor(timeDiff / 60000);
          const timeStr = minsAgo < 1 ? 'now' : minsAgo < 60 ? `${minsAgo}m ago` : `${Math.floor(minsAgo / 60)}h ago`;

          markerMap.set(keyword, {
            id: `tel-${keyword.replace(/\s+/g, '-')}`,
            name: keyword.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            lat: location.lat,
            lng: location.lng,
            severity: severity as "high" | "medium" | "low",
            country: location.country,
            description: text.substring(0, 120) + (text.length > 120 ? '...' : ''),
            timestamp: timeStr,
            flag: location.flag,
          });
        }
      }
    }
  }

  return Array.from(markerMap.values());
}

// Critical regions are now derived dynamically from conflict markers
// Only high-severity markers get 3D labels with pinpoints
function getCriticalRegions(markers: ConflictMarker[]) {
  return markers
    .filter(m => m.severity === "high")
    .map(m => ({ name: m.name, lat: m.lat, lng: m.lng, flag: m.flag || "⚠️", severity: m.severity as "high" }));
}

// Ship data removed - was static/fake data
// The ship layer has been replaced with a "Labels" info layer

// Channel colors for attractive badges
const CHANNEL_STYLES: Record<string, { bg: string; text: string; border: string; icon: string }> = {
  "wfwitness": { bg: "bg-rose-500/20", text: "text-rose-400", border: "border-rose-500/30", icon: "🔴" },
  "warmonitors": { bg: "bg-amber-500/20", text: "text-amber-400", border: "border-amber-500/30", icon: "⚠️" },
  "ethanlevins": { bg: "bg-emerald-500/20", text: "text-emerald-400", border: "border-emerald-500/30", icon: "🟢" },
  "Middle_East_Spectator": { bg: "bg-sky-500/20", text: "text-sky-400", border: "border-sky-500/30", icon: "🔵" },
  "rnintel": { bg: "bg-purple-500/20", text: "text-purple-400", border: "border-purple-500/30", icon: "🟣" },
  "SabrenNewss": { bg: "bg-orange-500/20", text: "text-orange-400", border: "border-orange-500/30", icon: "🟠" },
  "AjaNews": { bg: "bg-red-500/20", text: "text-red-400", border: "border-red-500/30", icon: "📰" },
};

// Default style for unknown channels
const DEFAULT_CHANNEL_STYLE = { bg: "bg-zinc-500/20", text: "text-zinc-400", border: "border-zinc-500/30", icon: "📡" };

// No static headline fallback - headlines always come from the API

// ============================================
// Marquee Headlines
// ============================================

interface Headline {
  id: string;
  source: string;
  sourceUsername: string;
  text: string;
  timestamp: string;
}

function MarqueeHeadlines() {
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch latest headlines
  const fetchHeadlines = useCallback(async (forceRefresh = false) => {
    try {
      // Add refresh=true to force fresh data from Telegram
      const url = forceRefresh 
        ? '/api/telegram?limit=20&refresh=true'
        : '/api/telegram?limit=20';
      
      const response = await fetch(url, {
        headers: {
          'x-api-secret': 'newstel-internal-2024'
        }
      });
      const data = await response.json();
      
      if (data.success && data.data?.messages?.length > 0) {
        const formattedHeadlines: Headline[] = data.data.messages.slice(0, 15).map((msg: any) => ({
          id: msg.id,
          source: msg.channelName || 'News',
          sourceUsername: msg.channelUsername || '',
          text: msg.text?.substring(0, 100) || 'Breaking news update...',
          timestamp: msg.timestamp,
        }));
        setHeadlines(formattedHeadlines);
      }
    } catch (error) {
      console.error('[Marquee] Failed to fetch headlines:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch with refresh to get latest news immediately
    fetchHeadlines(true);
    // Refresh every 30 seconds with force refresh
    const interval = setInterval(() => fetchHeadlines(true), 30000);
    return () => clearInterval(interval);
  }, [fetchHeadlines]);

  // Get channel style
  const getChannelStyle = (username: string) => {
    return CHANNEL_STYLES[username] || DEFAULT_CHANNEL_STYLE;
  };

  // Format relative time
  const formatTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'now';
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  // If no headlines from API, show loading message
  const displayHeadlines = headlines.length > 0 ? headlines : [{
    id: 'loading',
    source: 'System',
    sourceUsername: 'system',
    text: loading ? 'Loading headlines...' : 'Unable to fetch headlines — data will refresh automatically',
    timestamp: new Date().toISOString(),
  }];

  return (
    <div className="fixed top-14 left-0 right-0 z-20 bg-black/90 backdrop-blur-xl border-b border-white/5 overflow-hidden">
      <div className="py-1.5 whitespace-nowrap animate-marquee flex items-center">
        {/* Duplicate content for seamless loop */}
        {[...displayHeadlines, ...displayHeadlines].map((headline, index) => {
          const style = getChannelStyle(headline.sourceUsername);
          return (
            <span key={`${headline.id}-${index}`} className="inline-flex items-center gap-2 px-4">
              {/* Channel Badge */}
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${style.bg} ${style.text} border ${style.border}`}>
                <span>{style.icon}</span>
                <span>{headline.source}</span>
              </span>
              {/* Headline text */}
              <span className="text-xs text-zinc-300">{headline.text}</span>
              {/* Time */}
              {headline.timestamp && (
                <span className="text-[10px] text-zinc-600">• {formatTime(headline.timestamp)}</span>
              )}
              {/* Separator */}
              <span className="text-zinc-700 mx-2">|</span>
            </span>
          );
        })}
      </div>
      <style jsx>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          display: inline-flex;
          animation: marquee 90s linear infinite;
        }
        .animate-marquee:hover {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}

// ============================================
// Layer Controls
// ============================================

function LayerControls({
  showConflicts, setShowConflicts,
  showAircraft, setShowAircraft,
  showDetails, setShowDetails,
  conflictCount, aircraftCount,
}: {
  showConflicts: boolean; setShowConflicts: (v: boolean) => void;
  showAircraft: boolean; setShowAircraft: (v: boolean) => void;
  showDetails: boolean; setShowDetails: (v: boolean) => void;
  conflictCount: number; aircraftCount: number;
}) {
  return (
    <div className="fixed top-28 left-1/2 -translate-x-1/2 z-20">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-black/80 backdrop-blur-xl rounded-full border border-white/10">
        <button onClick={() => setShowConflicts(!showConflicts)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${
            showConflicts ? "bg-red-500/20 text-red-400 border border-red-500/30" 
            : "bg-white/5 text-zinc-500 border border-transparent hover:bg-white/10"}`}>
          {showConflicts ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <Zap className="w-3.5 h-3.5" />
          <span>{conflictCount}</span>
        </button>

        <div className="w-px h-5 bg-white/10" />

        <button onClick={() => setShowAircraft(!showAircraft)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${
            showAircraft ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30" 
            : "bg-white/5 text-zinc-500 border border-transparent hover:bg-white/10"}`}>
          {showAircraft ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <Plane className="w-3.5 h-3.5" />
          <span>{aircraftCount}</span>
        </button>

        <div className="w-px h-5 bg-white/10" />

        <button onClick={() => setShowDetails(!showDetails)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-xs font-medium ${
            showDetails ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" 
            : "bg-white/5 text-zinc-500 border border-transparent hover:bg-white/10"}`}>
          {showDetails ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          <Info className="w-3.5 h-3.5" />
          <span>Labels</span>
        </button>
      </div>
    </div>
  );
}

// ============================================
// Info Panel
// ============================================

function InfoPanel({ item, onClose }: { item: { type: string; data: any } | null; onClose: () => void }) {
  if (!item) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="absolute bottom-24 md:bottom-8 left-4 right-4 md:left-1/2 md:-translate-x-1/2 md:max-w-md bg-black/95 backdrop-blur-xl rounded-2xl border border-white/10 p-5 shadow-2xl z-30"
    >
      <button onClick={onClose}
        className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors">
        <X className="w-4 h-4 text-zinc-400" />
      </button>

      {item.type === "conflict" && (
        <>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg ${
              item.data.severity === "high" ? "bg-red-500/20" : 
              item.data.severity === "medium" ? "bg-amber-500/20" : "bg-green-500/20"
            }`}>
              {item.data.flag || "⚠️"}
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{item.data.name}</p>
              <p className="text-zinc-400 text-sm">{item.data.country}</p>
            </div>
            <span className={`ml-auto text-[10px] px-2 py-1 rounded-full font-medium ${
              item.data.severity === "high" ? "bg-red-500/20 text-red-400" : 
              item.data.severity === "medium" ? "bg-amber-500/20 text-amber-400" : "bg-green-500/20 text-green-400"
            }`}>{item.data.severity.toUpperCase()}</span>
          </div>
          <p className="text-zinc-300 text-sm mt-4">{item.data.description}</p>
          <div className="flex items-center gap-2 mt-3 text-xs text-zinc-500">
            <span>📍 {item.data.lat?.toFixed(2)}°, {item.data.lng?.toFixed(2)}°</span>
            <span>•</span>
            <span>{item.data.timestamp}</span>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500">Regional Tension</span>
              <span className={`text-sm font-semibold ${
                item.data.severity === "high" ? "text-red-400" : 
                item.data.severity === "medium" ? "text-amber-400" : "text-green-400"
              }`}>
                {item.data.severity === "high" ? "87%" : item.data.severity === "medium" ? "54%" : "23%"}
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full ${
                item.data.severity === "high" ? "bg-red-500" : 
                item.data.severity === "medium" ? "bg-amber-500" : "bg-green-500"
              }`} style={{ width: item.data.severity === "high" ? "87%" : item.data.severity === "medium" ? "54%" : "23%" }} />
            </div>
          </div>
        </>
      )}

      {item.type === "aircraft" && (
        <>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
              <Plane className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{item.data.flight || item.data.registration || "Unknown"}</p>
              <p className="text-zinc-400 text-sm">{item.data.type || item.data.aircraftType || "Military Aircraft"}</p>
            </div>
            <span className="ml-auto text-[10px] px-2 py-1 bg-amber-500/20 text-amber-400 rounded-full font-medium">
              {item.data.military ? "MILITARY" : item.data.aircraftType?.toUpperCase() || "AIRCRAFT"}
            </span>
          </div>
          
          <div className="grid grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/10">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Altitude</p>
              <p className="text-white font-semibold mt-1">{item.data.alt_baro?.toLocaleString() || "—"} ft</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Speed</p>
              <p className="text-white font-semibold mt-1">{item.data.gs || "—"} kts</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Heading</p>
              <p className="text-white font-semibold mt-1">{item.data.track || "—"}°</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Hex Code</p>
              <p className="text-white font-semibold mt-1 font-mono text-sm">{item.data.hex || "—"}</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Registration</p>
              <p className="text-zinc-300 text-sm mt-1">{item.data.registration || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Squawk</p>
              <p className="text-zinc-300 text-sm mt-1 font-mono">{item.data.squawk || "—"}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Last Seen</p>
              <p className="text-zinc-300 text-sm mt-1">{item.data.seen ? `${item.data.seen}s ago` : "—"}</p>
            </div>
          </div>
          
          <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-500">
            <span>📍 {item.data.lat?.toFixed(4)}°, {item.data.lng?.toFixed(4)}°</span>
          </div>
        </>
      )}

      {item.type === "ship" && (
        <>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-xl flex items-center justify-center">
              <Info className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-white font-semibold text-lg">{item.data.name}</p>
              <p className="text-zinc-400 text-sm">{item.data.type || "Location marker"}</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center gap-2 text-xs text-zinc-500">
            <span>📍 {item.data.lat?.toFixed(4)}°, {item.data.lng?.toFixed(4)}°</span>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ============================================
// Create Icon Texture - Subtle glow
// ============================================

function createIconTexture(
  THREE: any,
  type: "conflict" | "aircraft" | "ship",
  severity?: "high" | "medium" | "low"
): any {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d")!;

  // Colors: Cyan for aircraft, Yellow for location markers, Red/Amber/Green for conflicts
  const color = type === "conflict" 
    ? (severity === "high" ? "#ff4444" : severity === "medium" ? "#ffaa00" : "#44ff66")
    : type === "aircraft" ? "#00ccff" : "#ffcc00";

  // Subtle outer glow
  const glowGradient = ctx.createRadialGradient(32, 32, 8, 32, 32, 32);
  glowGradient.addColorStop(0, color + "ff");
  glowGradient.addColorStop(0.5, color + "40");
  glowGradient.addColorStop(1, "transparent");
  ctx.fillStyle = glowGradient;
  ctx.beginPath();
  ctx.arc(32, 32, 30, 0, Math.PI * 2);
  ctx.fill();

  // Draw solid icon
  ctx.fillStyle = color;
  ctx.strokeStyle = "rgba(255,255,255,0.8)";
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (type === "conflict") {
    // Warning triangle
    ctx.beginPath();
    ctx.moveTo(32, 12);
    ctx.lineTo(52, 48);
    ctx.lineTo(12, 48);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Exclamation
    ctx.fillStyle = "white";
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(32, 20);
    ctx.lineTo(32, 34);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(32, 40, 2, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === "aircraft") {
    // Aircraft shape
    ctx.save();
    ctx.translate(32, 32);
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(5, -7);
    ctx.lineTo(18, -3);
    ctx.lineTo(18, 3);
    ctx.lineTo(5, 0);
    ctx.lineTo(5, 11);
    ctx.lineTo(10, 18);
    ctx.lineTo(7, 18);
    ctx.lineTo(0, 11);
    ctx.lineTo(-7, 18);
    ctx.lineTo(-10, 18);
    ctx.lineTo(-5, 11);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-18, 3);
    ctx.lineTo(-18, -3);
    ctx.lineTo(-5, -7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    // Location marker (replaces ship)
    ctx.beginPath();
    ctx.arc(32, 22, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // Pin point
    ctx.beginPath();
    ctx.moveTo(24, 30);
    ctx.lineTo(32, 48);
    ctx.lineTo(40, 30);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Inner dot
    ctx.fillStyle = "white";
    ctx.beginPath();
    ctx.arc(32, 22, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// ============================================
// Globe Renderer
// ============================================

function GlobeRenderer({
  aircraft = [],
  conflictMarkers = [],
  showConflicts, showAircraft, showDetails,
  onMarkerClick,
}: {
  aircraft?: AircraftData[];
  conflictMarkers?: ConflictMarker[];
  showConflicts: boolean;
  showAircraft: boolean;
  showDetails: boolean;
  onMarkerClick: (type: string, data: any) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const globeStateRef = useRef<{
    renderer: any; scene: any; camera: any; controls: any;
    earth: any; markersGroup: any; labelsGroup: any; clickables: any[];
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let mounted = true;

    const init = async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import("three/examples/jsm/controls/OrbitControls.js");

      if (!mounted || !containerRef.current) return;

      // Renderer
      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 1); // BLACK space
      containerRef.current.innerHTML = "";
      containerRef.current.appendChild(renderer.domElement);

      // Scene & Camera
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.z = 2.5;

      // Controls - NO AUTO ROTATION
      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enablePan = false;
      controls.minDistance = 1.3;
      controls.maxDistance = 5;
      controls.rotateSpeed = 0.5;
      controls.enableDamping = true;
      controls.autoRotate = false;

      // Lighting
      scene.add(new THREE.AmbientLight(0xffffff, 1.0));
      const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
      sunLight.position.set(5, 3, 5);
      scene.add(sunLight);

      // Earth
      const earthGeom = new THREE.SphereGeometry(1, 64, 64);
      const earthMat = new THREE.MeshStandardMaterial({ color: 0x2277aa, metalness: 0.1, roughness: 0.7 });
      const earth = new THREE.Mesh(earthGeom, earthMat);
      scene.add(earth);

      // Markers group (attached to earth for rotation sync)
      const markersGroup = new THREE.Group();
      earth.add(markersGroup);

      // Labels group (separate for parallax effect - slightly offset from earth rotation)
      const labelsGroup = new THREE.Group();
      scene.add(labelsGroup);

      // Stars - BLACK space with white stars
      const starsGeom = new THREE.BufferGeometry();
      const starPos = new Float32Array(3000 * 3);
      for (let i = 0; i < 3000 * 3; i += 3) {
        const r = 50 + Math.random() * 50;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starPos[i] = r * Math.sin(phi) * Math.cos(theta);
        starPos[i + 1] = r * Math.sin(phi) * Math.sin(theta);
        starPos[i + 2] = r * Math.cos(phi);
      }
      starsGeom.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
      scene.add(new THREE.Points(starsGeom, new THREE.PointsMaterial({ color: 0xffffff, size: 0.1 })));

      // Store state
      globeStateRef.current = { renderer, scene, camera, controls, earth, markersGroup, labelsGroup, clickables: [] };

      // Load texture
      new THREE.TextureLoader().load(
        "https://cdn.jsdelivr.net/npm/three-globe@2.24.13/example/img/earth-blue-marble.jpg",
        (tex: any) => {
          if (!mounted) return;
          tex.colorSpace = THREE.SRGBColorSpace;
          earthMat.map = tex;
          earthMat.color.set(0xffffff);
          earthMat.needsUpdate = true;
        }
      );

      // Animation loop
      const animate = () => {
        if (!mounted) return;
        requestAnimationFrame(animate);
        controls.update();
        
        // Parallax effect: labels follow earth rotation but slightly slower
        labelsGroup.rotation.x = earth.rotation.x * 0.85;
        labelsGroup.rotation.y = earth.rotation.y * 0.85;
        labelsGroup.rotation.z = earth.rotation.z * 0.85;
        
        renderer.render(scene, camera);
      };
      animate();

      // Resize
      const handleResize = () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener("resize", handleResize);

      // Click handler
      const handleClick = (e: MouseEvent) => {
        if (!globeStateRef.current) return;
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, camera);
        const hits = raycaster.intersectObjects(globeStateRef.current.clickables, true);
        if (hits.length > 0 && hits[0].object.userData?.type) {
          onMarkerClick(hits[0].object.userData.type, hits[0].object.userData.data);
        }
      };
      renderer.domElement.addEventListener("click", handleClick);
    };

    init();

    return () => {
      mounted = false;
      if (globeStateRef.current) {
        globeStateRef.current.controls.dispose();
        globeStateRef.current.renderer.dispose();
        if (containerRef.current) containerRef.current.innerHTML = "";
      }
    };
  }, [onMarkerClick]);

  // Update markers
  useEffect(() => {
    if (!globeStateRef.current) return;

    const updateMarkers = async () => {
      const THREE = await import("three");
      const { earth, markersGroup, labelsGroup, clickables } = globeStateRef.current!;

      // Clear old markers and labels
      while (markersGroup.children.length) markersGroup.remove(markersGroup.children[0]);
      while (labelsGroup.children.length) labelsGroup.remove(labelsGroup.children[0]);
      clickables.length = 0;

      const latLngToPos = (lat: number, lng: number, alt: number) => {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lng + 180) * (Math.PI / 180);
        const r = 1 + alt;
        return new THREE.Vector3(
          -r * Math.sin(phi) * Math.cos(theta),
          r * Math.cos(phi),
          r * Math.sin(phi) * Math.sin(theta)
        );
      };

      // Create sprite markers - subtle glow
      const createSprite = (type: "conflict" | "aircraft" | "ship", data: any, severity?: "high" | "medium" | "low") => {
        const texture = createIconTexture(THREE, type, severity);
        const material = new THREE.SpriteMaterial({ 
          map: texture, 
          transparent: true, 
          depthTest: true,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(material);
        sprite.scale.set(0.045, 0.045, 1);
        sprite.userData = { type, data };
        return sprite;
      };

      // Create 3D label with pinpoint for critical regions
      const createRegionLabel = (region: { name: string; lat: number; lng: number; flag: string; severity: "high" }) => {
        const group = new THREE.Group();
        
        // Position on globe surface
        const surfacePos = latLngToPos(region.lat, region.lng, 0);
        
        // Label position (floating above)
        const labelPos = latLngToPos(region.lat, region.lng, 0.15);
        
        // Create pinpoint line
        const lineGeom = new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(surfacePos.x, surfacePos.y, surfacePos.z),
          new THREE.Vector3(labelPos.x, labelPos.y, labelPos.z)
        ]);
        const lineMat = new THREE.LineBasicMaterial({ 
          color: region.severity === "high" ? 0xff4444 : 0xffaa00, 
          transparent: true, 
          opacity: 0.6 
        });
        const line = new THREE.Line(lineGeom, lineMat);
        group.add(line);
        
        // Create dot at surface
        const dotGeom = new THREE.SphereGeometry(0.008, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({ 
          color: region.severity === "high" ? 0xff4444 : 0xffaa00 
        });
        const dot = new THREE.Mesh(dotGeom, dotMat);
        dot.position.copy(surfacePos);
        group.add(dot);
        
        // Create text sprite for label - auto-size based on text
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d")!;
        
        // Measure text to size canvas properly
        ctx.font = "bold 18px sans-serif";
        const textWidth = ctx.measureText(region.name).width;
        const padding = 16;
        const flagWidth = 28;
        const totalWidth = Math.ceil(textWidth + flagWidth + padding * 3);
        
        canvas.width = totalWidth;
        canvas.height = 36;
        
        // Background pill - fits content
        ctx.fillStyle = "rgba(0,0,0,0.85)";
        ctx.beginPath();
        ctx.roundRect(2, 2, totalWidth - 4, 32, 16);
        ctx.fill();
        
        // Border
        ctx.strokeStyle = region.severity === "high" ? "#ff4444" : "#ffaa00";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Flag
        ctx.font = "20px sans-serif";
        ctx.fillText(region.flag, 10, 24);
        
        // Name
        ctx.font = "bold 16px sans-serif";
        ctx.fillStyle = "white";
        ctx.fillText(region.name, 36, 23);
        
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMat = new THREE.SpriteMaterial({ 
          map: texture, 
          transparent: true, 
          depthTest: false 
        });
        const sprite = new THREE.Sprite(spriteMat);
        sprite.position.copy(labelPos);
        // Scale based on actual content width
        const scaleX = 0.08 + (totalWidth / 200) * 0.04;
        sprite.scale.set(scaleX, 0.025, 1);
        group.add(sprite);
        
        // Store region data for clicking
        sprite.userData = { type: "conflict", data: { ...region, country: region.name, description: `Critical region: ${region.name}` } };
        clickables.push(sprite);
        
        return group;
      };

      // Add conflict markers (from dynamic Telegram data or default fallback)
      if (showConflicts) {
        conflictMarkers.forEach(m => {
          const sprite = createSprite("conflict", m, m.severity);
          sprite.position.copy(latLngToPos(m.lat, m.lng, 0.015));
          markersGroup.add(sprite);
          clickables.push(sprite);
        });
      }

      // Show ALL aircraft with positions (removed the .slice(0, 50) limit)
      if (showAircraft) {
        aircraft.filter(a => a.lat && a.lng).forEach(ac => {
          const sprite = createSprite("aircraft", ac);
          sprite.position.copy(latLngToPos(ac.lat!, ac.lng!, 0.02));
          markersGroup.add(sprite);
          clickables.push(sprite);
        });
      }
      
      // Add 3D region labels with pinpoint (derived from conflict markers)
      if (showDetails) {
        const criticalRegions = getCriticalRegions(conflictMarkers);
        criticalRegions.forEach(region => {
          const label = createRegionLabel(region);
          labelsGroup.add(label);
        });
      }
    };

    updateMarkers();
  }, [showConflicts, showAircraft, showDetails, aircraft, conflictMarkers]);

  return <div ref={containerRef} className="absolute inset-0" />;
}

// ============================================
// Markets Panel
// ============================================

function MarketsPanel({ markets }: { markets: MarketData[] }) {
  if (markets.length === 0) return null;
  
  return (
    <div className="hidden md:block fixed top-16 right-0 bottom-0 w-72 z-10 overflow-y-auto p-3 space-y-3 pointer-events-none">
      <div className="pointer-events-auto space-y-3">
        <div className="bg-black/70 backdrop-blur-xl rounded-xl border border-white/5 overflow-hidden">
          <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-medium text-zinc-300">Markets</span>
          </div>
          <div className="divide-y divide-white/5">
            {markets.slice(0, 4).map((market) => {
              const isPositive = market.changePercent >= 0;
              return (
                <div key={market.symbol} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-xs text-zinc-400">{market.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{market.price.toLocaleString()}</span>
                    <span className={`text-xs flex items-center ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isPositive ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
                      {Math.abs(market.changePercent).toFixed(2)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Export
// ============================================

export function Globe3D({
  onMarkerClick,
  aircraft = [],
  conflictMarkers = DEFAULT_CONFLICT_MARKERS,
}: {
  onMarkerClick?: (marker: ConflictMarker) => void;
  aircraft?: AircraftData[];
  conflictMarkers?: ConflictMarker[];
}) {
  const [showConflicts, setShowConflicts] = useState(true);
  const [showAircraft, setShowAircraft] = useState(true);
  const [showDetails, setShowDetails] = useState(true);
  const [selectedItem, setSelectedItem] = useState<{ type: string; data: any } | null>(null);
  const [markets, setMarkets] = useState<MarketData[]>([]);

  // Fetch markets
  useEffect(() => {
    fetch('/api/market')
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          setMarkets(data.data.map((m: any) => ({
            symbol: m.symbol,
            name: m.name,
            price: m.price,
            change: m.change,
            changePercent: m.changePercent,
          })));
        }
      })
      .catch(() => {});
  }, []);

  const handleMarkerClick = useCallback((type: string, data: any) => {
    setSelectedItem({ type, data });
    if (type === "conflict") onMarkerClick?.(data);
  }, [onMarkerClick]);

  return (
    <div className="absolute inset-0 bg-black">
      <GlobeRenderer
        aircraft={aircraft}
        conflictMarkers={conflictMarkers}
        showConflicts={showConflicts}
        showAircraft={showAircraft}
        showDetails={showDetails}
        onMarkerClick={handleMarkerClick}
      />

      <MarqueeHeadlines />

      <LayerControls
        showConflicts={showConflicts} setShowConflicts={setShowConflicts}
        showAircraft={showAircraft} setShowAircraft={setShowAircraft}
        showDetails={showDetails} setShowDetails={setShowDetails}
        conflictCount={conflictMarkers.length}
        aircraftCount={aircraft.filter(a => a.lat && a.lng).length}
      />

      <MarketsPanel markets={markets} />

      <AnimatePresence>
        {selectedItem && <InfoPanel item={selectedItem} onClose={() => setSelectedItem(null)} />}
      </AnimatePresence>
    </div>
  );
}

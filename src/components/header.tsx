import { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  Search, 
  RefreshCw, 
  Menu, 
  X,
  Wifi,
  WifiOff,
  ChevronDown,
  ArrowUp,
  Filter,
  Radio,
  TrendingUp,
  Zap,
  Globe,
  Cpu,
  Trophy,
  Heart,
  Coins,
  Film,
  Atom,
  Settings,
  Sparkles,
  Globe2,
  Radar
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { subscribeToSettings, updateRefreshSettings, getSettings } from "@/lib/refresh-manager";
import { getPreferences, UserPreferences } from "@/lib/user-preferences";

// Genre types
export type Genre = 'war' | 'world' | 'technology' | 'sports' | 'health' | 'business' | 'entertainment' | 'science';

export const GENRE_CONFIG: Record<Genre, { label: string; icon: React.ReactNode; color: string; path: string }> = {
  war: { label: 'War', icon: <Zap className="h-4 w-4" />, color: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20', path: '/war' },
  world: { label: 'World', icon: <Globe className="h-4 w-4" />, color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20', path: '/world' },
  technology: { label: 'Tech', icon: <Cpu className="h-4 w-4" />, color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', path: '/technology' },
  sports: { label: 'Sports', icon: <Trophy className="h-4 w-4" />, color: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20', path: '/sports' },
  health: { label: 'Health', icon: <Heart className="h-4 w-4" />, color: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20', path: '/health' },
  business: { label: 'Business', icon: <Coins className="h-4 w-4" />, color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20', path: '/business' },
  entertainment: { label: 'Movies', icon: <Film className="h-4 w-4" />, color: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20', path: '/entertainment' },
  science: { label: 'Science', icon: <Atom className="h-4 w-4" />, color: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20', path: '/science' },
};

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onRefresh?: (forceRefresh?: boolean) => void;
  isRefreshing?: boolean;
  isLive?: boolean;
  showWarControls?: boolean;
  // War-specific props
  channels?: { username: string; name: string }[];
  selectedChannel?: string | null;
  onChannelChange?: (channel: string | null) => void;
  mediaFilter?: "all" | "photos" | "videos" | "none";
  onMediaFilterChange?: (filter: "all" | "photos" | "videos" | "none") => void;
  sortBy?: "newest" | "oldest" | "views" | "reactions";
  onSortChange?: (sort: "newest" | "oldest" | "views" | "reactions") => void;
  stats?: { today: number };
  nextRefreshIn?: number;
  isUpdating?: boolean;
}

export function Header({
  searchQuery,
  onSearchChange,
  onRefresh,
  isRefreshing = false,
  isLive = true,
  showWarControls = false,
  channels = [],
  selectedChannel = null,
  onChannelChange,
  mediaFilter = "all",
  onMediaFilterChange,
  sortBy = "newest",
  onSortChange,
  stats,
  nextRefreshIn,
  isUpdating = false,
}: HeaderProps) {
  const pathname = usePathname();
  const [sidePanelOpen, setSidePanelOpen] = useState(false);
  const [showCustomTimerPopup, setShowCustomTimerPopup] = useState(false);
  const [customRefreshEnabled, setCustomRefreshEnabled] = useState(false);
  const [customRefreshSeconds, setCustomRefreshSeconds] = useState(60);
  const [tempCustomSeconds, setTempCustomSeconds] = useState("60");
  const [popupPosition, setPopupPosition] = useState({ top: 0, right: 0 });
  // Initialize user preferences with lazy initializer
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(() => {
    if (typeof window === 'undefined') return null;
    return getPreferences();
  });
  const timerButtonRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  // Get visible categories based on user preferences
  const visibleCategories = useMemo(() => {
    if (!userPreferences) {
      return Object.keys(GENRE_CONFIG) as Genre[];
    }
    return userPreferences.categoryOrder.filter((id) =>
      userPreferences.enabledCategories.includes(id)
    ) as Genre[];
  }, [userPreferences]);

  // Subscribe to global settings
  const settingsRef = useRef({ initialized: false });
  
  useEffect(() => {
    if (settingsRef.current.initialized) return;
    settingsRef.current.initialized = true;
    
    const settings = getSettings();
    const timeoutId = setTimeout(() => {
      setCustomRefreshEnabled(settings.enabled);
      setCustomRefreshSeconds(settings.interval);
      setTempCustomSeconds(settings.interval.toString());
    }, 0);
    
    const unsubscribe = subscribeToSettings((enabled, interval) => {
      setCustomRefreshEnabled(enabled);
      setCustomRefreshSeconds(interval);
    });
    
    return () => {
      clearTimeout(timeoutId);
      unsubscribe();
    };
     
  }, []);

  // Update popup position when it opens
  useEffect(() => {
    if (showCustomTimerPopup && timerButtonRef.current) {
      const rect = timerButtonRef.current.getBoundingClientRect();
      setPopupPosition({
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right - 16,
      });
    }
  }, [showCustomTimerPopup]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showCustomTimerPopup && timerButtonRef.current && popupRef.current) {
        const target = e.target as Node;
        if (!timerButtonRef.current.contains(target) && !popupRef.current.contains(target)) {
          setShowCustomTimerPopup(false);
        }
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCustomTimerPopup]);

  const applyCustomTimer = () => {
    const seconds = parseInt(tempCustomSeconds, 10);
    if (seconds >= 5 && seconds <= 3600) {
      updateRefreshSettings(customRefreshEnabled, seconds);
      setShowCustomTimerPopup(false);
    }
  };
  
  const toggleCustomRefresh = () => {
    const newEnabled = !customRefreshEnabled;
    updateRefreshSettings(newEnabled, customRefreshSeconds);
  };

  return (
    <>
      {/* Side Panel */}
      <Sheet open={sidePanelOpen} onOpenChange={setSidePanelOpen}>
        <SheetContent side="left" className="w-72 p-0 flex flex-col max-h-screen">
          <SheetHeader className="p-4 border-b flex-shrink-0">
            <SheetTitle className="flex items-center gap-2">
              <img src="/logo.png" alt="newstel" className="h-8 w-8 rounded-lg" />
              <span>newstel</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto scrollbar-hide p-4">
            <nav className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Categories</div>
              {visibleCategories.map((genre) => (
                <Link
                  key={genre}
                  href={GENRE_CONFIG[genre].path}
                  onClick={() => setSidePanelOpen(false)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    pathname === GENRE_CONFIG[genre].path 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  {GENRE_CONFIG[genre].icon}
                  {GENRE_CONFIG[genre].label}
                </Link>
              ))}
            </nav>
            <div className="mt-6 pt-4 border-t">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">Tools</div>
              <Link
                href="/tools/world-monitor"
                onClick={() => setSidePanelOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname === '/tools/world-monitor' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                )}
              >
                <Globe2 className="h-4 w-4" />
                World Monitor
              </Link>
              <Link
                href="/live"
                onClick={() => setSidePanelOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname === '/live' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                )}
              >
                <Radio className="h-4 w-4" />
                Live News Streams
              </Link>
              <Link
                href="/market"
                onClick={() => setSidePanelOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname === '/market' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                )}
              >
                <TrendingUp className="h-4 w-4" />
                Market Monitor
              </Link>
            </div>
            <div className="mt-6 pt-4 border-t">
              <Link
                href="/settings"
                onClick={() => setSidePanelOpen(false)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                  pathname === '/settings' ? "bg-primary text-primary-foreground" : "hover:bg-muted text-foreground"
                )}
              >
                <Sparkles className="h-4 w-4" />
                Themes & Settings
              </Link>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 overflow-visible">
        <div className="container mx-auto px-4">
          <div className="flex h-14 items-center justify-between gap-4 relative">
            {/* Logo with Hamburger */}
            <div className="flex items-center gap-2.5">
              <Sheet open={sidePanelOpen} onOpenChange={setSidePanelOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-muted">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
              </Sheet>
              <Link href={userPreferences?.defaultCategory ? `/${userPreferences.defaultCategory}` : "/war"}>
                <img 
                  src="/logo.png" 
                  alt="newstel" 
                  className="h-10 w-10 rounded-lg object-contain cursor-pointer"
                />
              </Link>
              <div className="hidden sm:block">
                <Link href={userPreferences?.defaultCategory ? `/${userPreferences.defaultCategory}` : "/war"}>
                  <h1 className="text-lg font-semibold cursor-pointer">newstel</h1>
                </Link>
              </div>
            </div>

            {/* Search */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search news..."
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-9 pr-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {showWarControls ? (
                <>
                  {/* Live indicator - War only */}
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10">
                    {isLive ? (
                      <Wifi className="h-3.5 w-3.5 text-primary" />
                    ) : (
                      <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <span className="text-xs font-medium text-primary">LIVE</span>
                  </div>
                  
                  {/* Refresh button - War only */}
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRefresh?.(true)}
                      disabled={isRefreshing || isUpdating}
                      className={cn(
                        "h-9 w-9 transition-all duration-100 active:scale-90 select-none",
                        isUpdating && "text-green-500 hover:text-green-600 bg-green-500/10"
                      )}
                      title="Refresh now"
                    >
                      <RefreshCw className={cn("h-4 w-4", isUpdating && "animate-spin")} />
                    </Button>
                    
                    {isUpdating && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                        <span className="h-1 w-1 rounded-full bg-green-500 animate-blink" style={{ animationDelay: '0ms' }} />
                        <span className="h-1 w-1 rounded-full bg-green-500 animate-blink" style={{ animationDelay: '150ms' }} />
                        <span className="h-1 w-1 rounded-full bg-green-500 animate-blink" style={{ animationDelay: '300ms' }} />
                      </div>
                    )}
                  </div>
                </>
              ) : onRefresh && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onRefresh()}
                  disabled={isRefreshing}
                  className="h-9 w-9"
                  title="Refresh news"
                >
                  <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Timer popup - rendered outside header - War only */}
      {showCustomTimerPopup && showWarControls && (
        <div 
          ref={popupRef}
          className="timer-popup fixed bg-popover border rounded-xl shadow-xl p-3 w-[280px]"
          style={{
            top: popupPosition.top,
            right: popupPosition.right,
            zIndex: 9999,
          }}
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-medium text-muted-foreground">Auto Refresh</div>
              <button
                onClick={toggleCustomRefresh}
                className={cn(
                  "relative w-10 h-5 rounded-full transition-colors duration-200",
                  customRefreshEnabled ? "bg-primary" : "bg-muted"
                )}
                title={customRefreshEnabled ? "ON - click to disable" : "OFF - click to enable"}
              >
                <span 
                  className={cn(
                    "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200",
                    customRefreshEnabled && "translate-x-5"
                  )} 
                />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={tempCustomSeconds}
                onChange={(e) => setTempCustomSeconds(e.target.value)}
                placeholder="sec"
                className="h-9 w-20 text-sm"
                min={5}
                max={3600}
              />
              <span className="text-xs text-muted-foreground">seconds</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setTempCustomSeconds("20")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors",
                  tempCustomSeconds === "20" && "bg-primary text-primary-foreground border-primary"
                )}
              >
                20s
              </button>
              <button
                onClick={() => setTempCustomSeconds("30")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors",
                  tempCustomSeconds === "30" && "bg-primary text-primary-foreground border-primary"
                )}
              >
                30s
              </button>
              <button
                onClick={() => setTempCustomSeconds("60")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors",
                  tempCustomSeconds === "60" && "bg-primary text-primary-foreground border-primary"
                )}
              >
                1m
              </button>
              <button
                onClick={() => setTempCustomSeconds("300")}
                className={cn(
                  "flex-1 py-1.5 text-xs rounded-lg border hover:bg-muted transition-colors",
                  tempCustomSeconds === "300" && "bg-primary text-primary-foreground border-primary"
                )}
              >
                5m
              </button>
            </div>
            <div className="flex gap-2 pt-1">
              <Button 
                variant="outline"
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={() => setShowCustomTimerPopup(false)}
              >
                Close
              </Button>
              <Button 
                size="sm" 
                className="flex-1 h-8 text-xs"
                onClick={applyCustomTimer}
                disabled={parseInt(tempCustomSeconds, 10) < 5 || parseInt(tempCustomSeconds, 10) > 3600}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar - War only */}
      {showWarControls && (
        <div className="border-b bg-muted/30">
          <div className="container mx-auto px-4 py-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live
                </span>
                <span>{stats?.today || 0} updates today</span>
              </div>
              <button
                ref={timerButtonRef}
                onClick={() => {
                  setTempCustomSeconds(customRefreshSeconds.toString());
                  setShowCustomTimerPopup(!showCustomTimerPopup);
                }}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all duration-150",
                  "hover:bg-muted/50 active:scale-95",
                  showCustomTimerPopup ? "border-primary/50 bg-primary/5" : "border-border/50 hover:border-border",
                  customRefreshEnabled && "border-primary/30 bg-primary/5"
                )}
              >
                <span>Next update in</span>
                <span className="font-mono text-[10px] tabular-nums font-medium text-foreground">{nextRefreshIn}s</span>
                {customRefreshEnabled && (
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters - War only */}
      {showWarControls && onChannelChange && onMediaFilterChange && onSortChange && (
        <div className="border-b bg-background">
          <div className="container mx-auto px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Channel Filters */}
              <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                <Button
                  variant={selectedChannel === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => onChannelChange(null)}
                  className="h-7 text-xs rounded-full"
                >
                  All
                </Button>
                {channels.map((channel) => (
                  <Button
                    key={channel.username}
                    variant={selectedChannel === channel.username ? "default" : "outline"}
                    size="sm"
                    onClick={() => onChannelChange(channel.username)}
                    className="h-7 text-xs rounded-full whitespace-nowrap"
                  >
                    {channel.name}
                  </Button>
                ))}
              </div>

              <div className="flex-1" />

              {/* Sort & Filter Dropdowns */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Filter className="h-3 w-3 mr-1" />
                    {mediaFilter === "all" ? "All Media" : mediaFilter === "photos" ? "Photos" : mediaFilter === "videos" ? "Videos" : "Text Only"}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32">
                  <DropdownMenuItem onClick={() => onMediaFilterChange("all")}>All Media</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMediaFilterChange("photos")}>Photos Only</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMediaFilterChange("videos")}>Videos Only</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onMediaFilterChange("none")}>Text Only</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <ArrowUp className="h-3 w-3 mr-1" />
                    {sortBy === "newest" ? "Newest" : sortBy === "oldest" ? "Oldest" : sortBy === "views" ? "Most Views" : "Most Reactions"}
                    <ChevronDown className="h-3 w-3 ml-1" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-36">
                  <DropdownMenuItem onClick={() => onSortChange("newest")}>Newest First</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSortChange("oldest")}>Oldest First</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSortChange("views")}>Most Views</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSortChange("reactions")}>Most Reactions</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

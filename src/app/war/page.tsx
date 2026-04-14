"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Header, GENRE_CONFIG } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { MediaViewer } from "@/components/media-viewer";
import { TelegramMessageCard, TelegramMessage } from "@/components/telegram-message";
import { MessageSkeleton, LogoLoader } from "@/components/skeleton";
import { ChevronDown, Search, ArrowUp, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToTimer, triggerRefresh, updateRefreshSettings, getSettings } from "@/lib/refresh-manager";
import { getPreferences, UserPreferences } from "@/lib/user-preferences";

// ============================================
// Types
// ============================================

interface TelegramChannel {
  username: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  subscriberCount: string | null;
}

interface ApiResponse {
  success: boolean;
  data: {
    channels: TelegramChannel[];
    messages: TelegramMessage[];
    total: number;
    todayCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
    lastUpdated: string | null;
  };
  meta: {
    cacheAgeSeconds: number;
    isScraping: boolean;
    availableChannels: readonly string[];
  };
}

interface StatusResponse {
  success: boolean;
  isScraping: boolean;
  lastScrapeTime: string | null;
  cacheAgeSeconds: number;
  isDataFresh: boolean;
  totalMessages: number;
  todayCount: number;
  isTranslating: boolean;
}

// ============================================
// Constants
// ============================================

const PAGE_SIZE = 20;
const STATUS_POLL_INTERVAL = 5000; // Poll status every 5 seconds
const FRESH_DATA_THRESHOLD = 60; // Data is fresh if < 60s old

// ============================================
// War Page Component
// ============================================

export default function WarPage() {
  // Data state
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState(0);
  
  // Loading states
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  
  // Scrape status
  const [isScraping, setIsScraping] = useState(false);
  const [isLive, setIsLive] = useState(true);
  
  // New updates tracking
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const lastTotalRef = useRef(0);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Media viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<{ type: 'image' | 'video'; url: string; thumbnail?: string; duration?: string } | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "views" | "reactions">("newest");
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos" | "none">("all");
  
  // User preferences
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  
  // Refresh timer
  const [nextRefreshIn, setNextRefreshIn] = useState(60);
  const prevTimeRef = useRef<number>(60);
  
  // Infinite scroll
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ============================================
  // Data Fetching
  // ============================================
  
  /**
   * Fetch a page of messages (with optional search, channel, and media filters)
   */
  const fetchPage = useCallback(async (
    page: number, 
    refresh: boolean = false,
    search?: string,
    channel?: string | null,
    media?: 'all' | 'photos' | 'videos' | 'none'
  ) => {
    try {
      if (refresh && page === 1) {
        setRefreshing(true);
      } else if (page > 1) {
        setLoadingMore(true);
      }
      
      if (refresh) {
        setIsScraping(true);
      }
      
      setError(null);
      
      // Build URL with optional filters
      let url = `/api/telegram?page=${page}&limit=${PAGE_SIZE}`;
      if (refresh) url += '&refresh=true';
      if (search && search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (channel) url += `&channel=${encodeURIComponent(channel)}`;
      if (media && media !== 'all') url += `&media=${media}`;
      
      const response = await fetch(url, {
        headers: { 'x-api-secret': 'newstel-internal-2024' }
      });
      const result: ApiResponse = await response.json();
      
      if (result.success) {
        const newMessages = result.data.messages;
        
        // Update message IDs set
        const newIds = new Set(newMessages.map(m => m.id));
        prevMessageIdsRef.current = newIds;
        
        if (page === 1) {
          // First page - replace all
          setMessages(newMessages);
          setChannels(result.data.channels);
          setTotalMessages(result.data.total);
          setTodayCount(result.data.todayCount);
          lastTotalRef.current = result.data.total;
        } else {
          // Subsequent page - append messages only
          // Don't touch channels - they should already have all channels from first page
          setMessages(prev => [...prev, ...newMessages]);
        }
        
        setLastUpdated(result.data.lastUpdated);
        setCacheAge(result.meta.cacheAgeSeconds);
        setHasMore(result.data.hasMore);
        setCurrentPage(page);
        setIsScraping(result.meta.isScraping);
      } else {
        setError("Failed to load data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
      // Don't reset isScraping here - let it be controlled by API response
      // and status polling
    }
  }, []);
  
  /**
   * Fetch status (lightweight polling)
   * Also triggers auto-reload when scraping completes
   */
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/telegram/status', {
        headers: { 'x-api-secret': 'newstel-internal-2024' }
      });
      const result: StatusResponse = await response.json();
      
      if (result.success) {
        const wasScraping = isScraping;
        setCacheAge(result.cacheAgeSeconds);
        setIsScraping(result.isScraping || result.isTranslating);
        setTotalMessages(result.totalMessages);
        setTodayCount(result.todayCount);
        
        // Auto-reload when scraping just completed (was scraping, now not)
        // This also reloads when translation completes (isTranslating becomes false)
        if (wasScraping && !result.isScraping && !result.isTranslating) {
          console.log('[WarPage] Scraping & translation completed - auto-reloading data');
          fetchPage(1, false, debouncedSearch, selectedChannel, mediaFilter);
        }
        // If total messages increased, there's new data
        else if (result.totalMessages > lastTotalRef.current && lastTotalRef.current > 0) {
          const newCount = result.totalMessages - lastTotalRef.current;
          setNewUpdatesCount(newCount);
          setHasNewUpdates(true);
          lastTotalRef.current = result.totalMessages;
        }
      }
    } catch (err) {
      console.error('[WarPage] Status fetch error:', err);
    }
  }, [isScraping, fetchPage, debouncedSearch, selectedChannel, mediaFilter]);
  
  /**
   * Load more messages (infinite scroll)
   */
  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      fetchPage(currentPage + 1, false, debouncedSearch, selectedChannel, mediaFilter);
    }
  }, [currentPage, hasMore, loadingMore, fetchPage, debouncedSearch, selectedChannel, mediaFilter]);
  
  /**
   * Manual refresh - force scrape and reload
   */
  const handleRefresh = useCallback(() => {
    setHasNewUpdates(false);
    setNewUpdatesCount(0);
    fetchPage(1, true, debouncedSearch, selectedChannel, mediaFilter);
  }, [fetchPage, debouncedSearch, selectedChannel, mediaFilter]);
  
  /**
   * Handle "New Updates" click - reload first page
   */
  const handleNewUpdatesClick = useCallback(() => {
    setHasNewUpdates(false);
    setNewUpdatesCount(0);
    fetchPage(1, false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [fetchPage]);
  
  // ============================================
  // Effects
  // ============================================
  
  // Load user preferences on mount
  useEffect(() => {
    const prefs = getPreferences();
    setUserPreferences(prefs);
    
    const warSources = prefs.categorySources?.war?.enabled || [];
    if (warSources.length === 1) {
      setSelectedChannel(warSources[0]);
    }
  }, []);
  
  // Debounced search effect - wait 300ms after typing stops
  useEffect(() => {
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Set new timeout
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);
  
  // Fetch when debounced search changes
  useEffect(() => {
    // Reset and fetch first page with new search
    setCurrentPage(1);
    setMessages([]);
    fetchPage(1, false, debouncedSearch, selectedChannel, mediaFilter);
  }, [debouncedSearch]);
  
  // Fetch when channel filter changes
  useEffect(() => {
    // Reset and fetch first page with new channel
    setCurrentPage(1);
    setMessages([]);
    fetchPage(1, false, debouncedSearch, selectedChannel, mediaFilter);
  }, [selectedChannel]);
  
  // Fetch when media filter changes
  useEffect(() => {
    // Reset and fetch first page with new media filter
    setCurrentPage(1);
    setMessages([]);
    fetchPage(1, false, debouncedSearch, selectedChannel, mediaFilter);
  }, [mediaFilter]);
  
  // Initial fetch (only once on mount)
  useEffect(() => {
    fetchPage(1, false, '', null, 'all');
  }, []);
  
  // Subscribe to timer - NOTE: using refs to avoid re-subscribing on every render
  const fetchPageRef = useRef(fetchPage);
  const fetchStatusRef = useRef(fetchStatus);
  const cacheAgeRef = useRef(cacheAge);
  
  // Keep refs updated (no deps - runs on every render to keep refs current)
  useLayoutEffect(() => {
    fetchPageRef.current = fetchPage;
    fetchStatusRef.current = fetchStatus;
    cacheAgeRef.current = cacheAge;
  });
  
  useEffect(() => {
    const unsubscribe = subscribeToTimer((timeRemaining) => {
      setNextRefreshIn(timeRemaining);
      
      // Timer hit 0 - trigger background refresh
      if (prevTimeRef.current > 0 && timeRemaining === 0) {
        console.log('[WarPage] Timer hit 0 - triggering auto refresh');
        console.log('[WarPage] cacheAge:', cacheAgeRef.current, 'threshold:', FRESH_DATA_THRESHOLD);
        
        // Reset timer
        triggerRefresh();
        
        // Check status
        fetchStatusRef.current();
        
        // Trigger a page reload WITH refresh=true to force scrape
        // This ensures scraping happens regardless of data age
        setIsScraping(true);
        fetchPageRef.current(1, true);
      }
      
      prevTimeRef.current = timeRemaining;
    });
    
    return unsubscribe;
  }, []); // Empty deps - only subscribe once
  
  // Status polling
  useEffect(() => {
    const interval = setInterval(fetchStatus, STATUS_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus]);
  
  // Update cache age locally
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheAge(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Disable right-click on media
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('.media-viewer') || target.closest('.timer-popup')) {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener('contextmenu', handleContextMenu);
    return () => document.removeEventListener('contextmenu', handleContextMenu);
  }, []);
  
  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    
    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }
    
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMore]);
  
  // ============================================
  // Computed Values
  // ============================================
  
  // Filter channels based on user preferences
  // New channels (not in user's saved list) are enabled by default
  const visibleChannels = useMemo(() => {
    if (!userPreferences) return channels;
    const warSources = userPreferences.categorySources?.war?.enabled || [];
    if (warSources.length === 0) return channels;
    // Show all channels - new ones are enabled by default
    return channels;
  }, [channels, userPreferences]);
  
  // Filter and sort messages
  // NOTE: Channel, media, and search filtering is now done server-side
  // This only handles sorting (which doesn't affect pagination)
  const filteredMessages = useMemo(() => {
    let result = [...messages];
    
    // Only sort - filtering is done server-side now
    if (sortBy === "newest") {
      result.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } else if (sortBy === "oldest") {
      result.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    } else if (sortBy === "views") {
      result.sort((a, b) => b.views - a.views);
    } else if (sortBy === "reactions") {
      result.sort((a, b) => {
        const aReactions = a.reactions.reduce((sum, r) => sum + r.count, 0);
        const bReactions = b.reactions.reduce((sum, r) => sum + r.count, 0);
        return bReactions - aReactions;
      });
    }
    
    return result;
  }, [messages, sortBy]);
  
  // Stats - use server-provided todayCount for accuracy
  const stats = useMemo(() => {
    return {
      total: totalMessages,
      today: todayCount,
      withMedia: messages.filter((m) => m.photos.length > 0 || m.videos.length > 0).length,
      totalViews: messages.reduce((sum, m) => sum + m.views, 0),
    };
  }, [messages, totalMessages, todayCount]);
  
  // ============================================
  // Event Handlers
  // ============================================
  
  const openViewer = (type: 'image' | 'video', url: string, thumbnail?: string, duration?: string) => {
    setViewerMedia({ type, url, thumbnail, duration });
    setViewerOpen(true);
  };
  
  // ============================================
  // Render
  // ============================================
  
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
        isLive={isLive}
        showWarControls={true}
        channels={visibleChannels}
        selectedChannel={selectedChannel}
        onChannelChange={setSelectedChannel}
        mediaFilter={mediaFilter}
        onMediaFilterChange={setMediaFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        stats={stats}
        nextRefreshIn={nextRefreshIn}
        isUpdating={isScraping}
      />
      
      {/* New Updates Banner */}
      <AnimatePresence>
        {hasNewUpdates && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="sticky top-16 z-40 flex justify-center py-2 pointer-events-none"
          >
            <button
              onClick={handleNewUpdatesClick}
              className="pointer-events-auto flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-full text-sm font-medium shadow-lg hover:shadow-xl transition-all hover:scale-105"
            >
              <ArrowUp className="h-4 w-4" />
              {newUpdatesCount} new update{newUpdatesCount !== 1 ? 's' : ''}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Error State */}
      {error && (
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 rounded-lg p-4">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={handleRefresh} className="ml-auto">
              Retry
            </Button>
          </div>
        </div>
      )}
      
      {/* Main Content */}
      <main ref={mainContentRef} className="flex-1 pb-16">
        <div className="container mx-auto px-4 py-6">
          {loading && messages.length === 0 ? (
            <LogoLoader className="relative min-h-[60vh]" />
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p>No results found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMessages.map((message, index) => (
                  <TelegramMessageCard
                    key={message.id}
                    message={message}
                    index={index}
                    onOpenViewer={openViewer}
                  />
                ))}
              </div>
              
              {/* Load more trigger */}
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {loadingMore ? (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Loading more...</span>
                  </div>
                ) : hasMore ? (
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    className="gap-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Load more
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    All messages loaded ({filteredMessages.length} total)
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
      
      {/* Media Viewer */}
      <MediaViewer open={viewerOpen} onOpenChange={setViewerOpen} media={viewerMedia} />
      
      <Footer channelsCount={channels.length} totalUpdates={stats.total} />
      
      {/* Floating Buttons */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        <GenreSelector currentGenre="war" />
        <ThemeToggle />
      </div>
    </div>
  );
}

// ============================================
// Genre Selector Component
// ============================================

function GenreSelector({ currentGenre }: { currentGenre: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <div className="relative">
      {/* Expanded Menu */}
      <div
        className={cn(
          "absolute bottom-12 right-0 overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]",
          isOpen
            ? "opacity-100 scale-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-2 pointer-events-none"
        )}
      >
        <div className="bg-background/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-xl p-3 min-w-[200px]">
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(GENRE_CONFIG) as (keyof typeof GENRE_CONFIG)[]).map((genre) => (
              <Link
                key={genre}
                href={GENRE_CONFIG[genre].path}
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-200",
                  currentGenre === genre
                    ? GENRE_CONFIG[genre].color + " shadow-sm"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
                  {GENRE_CONFIG[genre].icon}
                </span>
                <span className="truncate">{GENRE_CONFIG[genre].label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
      
      {/* Button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm transition-all duration-300",
          isOpen && "bg-primary text-primary-foreground hover:bg-primary"
        )}
        title="Select category"
      >
        <div className={cn("transition-transform duration-300", isOpen && "rotate-180")}>
          {GENRE_CONFIG[currentGenre as keyof typeof GENRE_CONFIG]?.icon || GENRE_CONFIG.war.icon}
        </div>
      </Button>
    </div>
  );
}

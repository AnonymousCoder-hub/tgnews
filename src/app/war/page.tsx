"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Header, GENRE_CONFIG } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { MediaViewer } from "@/components/media-viewer";
import { TelegramMessageCard, TelegramMessage } from "@/components/telegram-message";
import { MessageSkeleton, LogoLoader } from "@/components/skeleton";
import { ChevronDown, Search, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { subscribeToTimer, triggerRefresh } from "@/lib/refresh-manager";

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
    lastUpdated: string | null;
  };
  meta?: {
    isCached: boolean;
    cacheAge: number | null;
    availableChannels: readonly string[];
  };
}

export default function WarPage() {
  const [messages, setMessages] = useState<TelegramMessage[]>([]);
  const [channels, setChannels] = useState<TelegramChannel[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  // New Updates tracking
  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [newUpdatesCount, setNewUpdatesCount] = useState(0);
  const initialLoadRef = useRef(true);
  const prevMessageIdsRef = useRef<Set<string>>(new Set());

  // Media viewer
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerMedia, setViewerMedia] = useState<{ type: 'image' | 'video'; url: string; thumbnail?: string; duration?: string } | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "views" | "reactions">("newest");
  const [mediaFilter, setMediaFilter] = useState<"all" | "photos" | "videos" | "none">("all");

  // Refresh tracking - show green updating indicator
  const [isUpdating, setIsUpdating] = useState(false);
  const [nextRefreshIn, setNextRefreshIn] = useState(60);
  const prevTimeRef = useRef<number>(60);

  // Infinite scroll
  const [visibleCount, setVisibleCount] = useState(20);
  const MESSAGES_PER_BATCH = 10;
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // Fetch data
  const fetchData = useCallback(async (forceRefresh = false, isBackground = false) => {
    try {
      if (forceRefresh) {
        setRefreshing(true);
        // Don't reset timer - let it keep counting
      }

      // Show updating indicator for manual/background refresh
      if (forceRefresh || isBackground) {
        setIsUpdating(true);
      }
      setError(null);

      const url = `/api/telegram${forceRefresh ? "?refresh=true" : ""}`;
      const response = await fetch(url, {
        headers: {
          'x-api-secret': 'newstel-internal-2024'
        }
      });
      const result: ApiResponse = await response.json();

      if (result.success) {
        // Check for new updates ONLY on background refresh (not manual refresh)
        if (isBackground && !initialLoadRef.current) {
          const prevIds = prevMessageIdsRef.current;
          const newMessages = result.data.messages.filter(msg => !prevIds.has(msg.id));

          if (newMessages.length > 0) {
            setNewUpdatesCount(newMessages.length);
            setHasNewUpdates(true);
          }
        }

        // Update previous message IDs
        const newIds = new Set(result.data.messages.map(m => m.id));
        prevMessageIdsRef.current = newIds;

        setMessages(result.data.messages);
        setChannels(result.data.channels);
        setLastUpdated(result.data.lastUpdated);
        setCacheAge(result.meta?.cacheAge ?? 0);

        // Mark initial load as complete
        if (initialLoadRef.current) {
          initialLoadRef.current = false;
        }
      } else {
        setError("Failed to load data");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
      setRefreshing(false);
      setIsUpdating(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Subscribe to global refresh timer
  useEffect(() => {
    const unsubscribe = subscribeToTimer((timeRemaining) => {
      setNextRefreshIn(timeRemaining);

      // Detect when timer transitions from 1 to 0
      // This means it's time to refresh
      if (prevTimeRef.current > 0 && timeRemaining === 0) {
        // Reset timer FIRST so it starts counting again
        triggerRefresh();
        // Then trigger background refresh
        fetchData(true, true);
      }

      prevTimeRef.current = timeRemaining;
    });

    return unsubscribe;
  }, [fetchData]);

  // Update cache age
  useEffect(() => {
    const interval = setInterval(() => {
      setCacheAge(prev => prev !== null ? prev + 1 : null);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Disable right-click
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

  // Reset visible count when filters change
  useEffect(() => {
    setVisibleCount(20);
  }, [searchQuery, selectedChannel, sortBy, mediaFilter]);

  // Filter and sort messages
  const filteredMessages = useMemo(() => {
    let result = [...messages];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (msg) =>
          msg.text?.toLowerCase().includes(query) ||
          msg.channelName.toLowerCase().includes(query)
      );
    }

    if (selectedChannel) {
      result = result.filter((msg) => msg.channelUsername === selectedChannel);
    }

    if (mediaFilter === "photos") {
      result = result.filter((msg) => msg.photos.length > 0);
    } else if (mediaFilter === "videos") {
      result = result.filter((msg) => msg.videos.length > 0);
    } else if (mediaFilter === "none") {
      result = result.filter((msg) => msg.photos.length === 0 && msg.videos.length === 0);
    }

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
  }, [messages, searchQuery, selectedChannel, sortBy, mediaFilter]);

  const displayMessages = filteredMessages.slice(0, visibleCount);
  const hasMore = visibleCount < filteredMessages.length;

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < filteredMessages.length) {
          setVisibleCount(prev => Math.min(prev + MESSAGES_PER_BATCH, filteredMessages.length));
        }
      },
      { rootMargin: '100px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [visibleCount, filteredMessages.length]);

  // Calculate stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    const todayMessages = messages.filter(m => new Date(m.timestamp).getTime() >= todayStart);

    return {
      total: messages.length,
      today: todayMessages.length,
      withMedia: messages.filter((m) => m.photos.length > 0 || m.videos.length > 0).length,
      totalViews: messages.reduce((sum, m) => sum + m.views, 0),
    };
  }, [messages]);

  // Open media viewer
  const openViewer = (type: 'image' | 'video', url: string, thumbnail?: string, duration?: string) => {
    setViewerMedia({ type, url, thumbnail, duration });
    setViewerOpen(true);
  };

  // Handle "New Updates" click
  const handleNewUpdatesClick = () => {
    setHasNewUpdates(false);
    setNewUpdatesCount(0);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
        isLive={isLive}
        showWarControls={true}
        channels={channels}
        selectedChannel={selectedChannel}
        onChannelChange={setSelectedChannel}
        mediaFilter={mediaFilter}
        onMediaFilterChange={setMediaFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        stats={stats}
        nextRefreshIn={nextRefreshIn}
        isUpdating={isUpdating}
      />

      {/* New Updates Banner - Discord style */}
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
            <Button variant="ghost" size="sm" onClick={() => fetchData(true)} className="ml-auto">
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
          ) : loading ? (
            <MessageSkeleton count={12} />
          ) : filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mb-4 opacity-50" />
              <p>No results found</p>
              <p className="text-sm">Try adjusting your filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayMessages.map((message, index) => (
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
                {hasMore ? (
                  <Button
                    variant="outline"
                    onClick={() => setVisibleCount(prev => Math.min(prev + MESSAGES_PER_BATCH, filteredMessages.length))}
                    className="gap-2"
                  >
                    <ChevronDown className="h-4 w-4" />
                    Load more ({filteredMessages.length - visibleCount} remaining)
                  </Button>
                ) : filteredMessages.length > 20 ? (
                  <p className="text-sm text-muted-foreground">All {filteredMessages.length} messages loaded</p>
                ) : null}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Media Viewer Dialog */}
      <MediaViewer open={viewerOpen} onOpenChange={setViewerOpen} media={viewerMedia} />

      <Footer channelsCount={channels.length} totalUpdates={stats.total} />

      {/* Floating Genre & Theme Buttons */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        <GenreSelector currentGenre="war" />
        <ThemeToggle />
      </div>
    </div>
  );
}

// Genre Selector Component
function GenreSelector({ currentGenre }: { currentGenre: string }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      {/* Expanded Genre Menu */}
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

      {/* Genre Button */}
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

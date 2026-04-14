"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header, Genre, GENRE_CONFIG } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { NewsCard } from "@/components/news-card";
import { NewsSkeleton, LogoLoader } from "@/components/skeleton";
import { Button } from "@/components/ui/button";
import { NewsArticle } from "@/lib/news-scraper";
import { Loader2, Globe, ChevronDown, Newspaper } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { getPreferences, UserPreferences, CATEGORY_SOURCES } from "@/lib/user-preferences";

interface GenrePageProps {
  genre: Genre;
}

// Source group from API
interface SourceGroup {
  source: string;
  articles: NewsArticle[];
  total: number;
  hasMore: boolean;
  loading?: boolean;
}

export function GenrePage({ genre }: GenrePageProps) {
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([]);
  const [sources, setSources] = useState<{ source: string; count: number }[]>([]);
  const [totalArticles, setTotalArticles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);

  // Articles per source to show initially
  const ARTICLES_PER_PAGE = 10;

  // Track if we've loaded data for this specific genre
  const loadedGenreRef = useMemo(() => ({ current: "" }), []);

  // Fetch initial data
  const fetchData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      const url = `/api/news?category=${genre}${forceRefresh ? "&refresh=true" : ""}&limit=${ARTICLES_PER_PAGE}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setSourceGroups(result.data);
        setSources(result.sources || []);
        setTotalArticles(result.totalArticles || 0);
        loadedGenreRef.current = genre;
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [genre, loadedGenreRef]);

  // Load more articles for a specific source
  const loadMoreForSource = useCallback(async (sourceName: string) => {
    // Find current source to get offset
    const currentSource = sourceGroups.find(s => s.source === sourceName);
    if (!currentSource || currentSource.loading) return;

    // Set loading state for this source
    setSourceGroups(prev => prev.map(s => 
      s.source === sourceName ? { ...s, loading: true } : s
    ));

    try {
      const offset = currentSource.articles.length;
      const url = `/api/news?category=${genre}&source=${encodeURIComponent(sourceName)}&offset=${offset}&limit=${ARTICLES_PER_PAGE}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setSourceGroups(prev => prev.map(s => 
          s.source === sourceName 
            ? { 
                ...s, 
                articles: [...s.articles, ...result.articles],
                hasMore: result.hasMore,
                loading: false 
              } 
            : s
        ));
      }
    } catch (error) {
      console.error('Failed to load more:', error);
      setSourceGroups(prev => prev.map(s => 
        s.source === sourceName ? { ...s, loading: false } : s
      ));
    }
  }, [genre, sourceGroups]);

  // Initial fetch when genre changes
  useEffect(() => {
    setLoading(true);
    setSourceGroups([]);
    setSources([]);
    setTotalArticles(0);
    fetchData();
  }, [genre]);

  // Track mount for animations
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load user preferences on mount
  useEffect(() => {
    const prefs = getPreferences();
    setUserPreferences(prefs);
  }, []);

  // Get enabled sources for this genre from preferences
  const enabledSources = useMemo(() => {
    if (!userPreferences) return null;
    const genreSources = userPreferences.categorySources?.[genre]?.enabled || [];
    return genreSources.length > 0 ? new Set(genreSources) : null;
  }, [userPreferences, genre]);

  // Filter by search query AND user preferences
  const filteredGroups = useMemo(() => {
    // First filter by user's enabled sources
    let groups = sourceGroups;
    if (enabledSources) {
      groups = groups.filter(group => enabledSources.has(group.source));
    }

    if (!searchQuery) return groups;

    return groups.map(group => ({
      ...group,
      articles: group.articles.filter(
        (article) =>
          article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.summary?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          article.source.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    })).filter(group => group.articles.length > 0);
  }, [sourceGroups, searchQuery, enabledSources]);

  const config = GENRE_CONFIG[genre];

  if (!mounted) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <div className="flex-1 flex items-center justify-center">
          <LogoLoader className="relative" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onRefresh={() => fetchData(true)}
        isRefreshing={refreshing}
        showWarControls={false}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {config.icon}
                {config.label} News
              </h2>
            </div>

            {loading && sourceGroups.length === 0 ? (
              <LogoLoader className="relative min-h-[50vh]" />
            ) : loading ? (
              <NewsSkeleton count={5} />
            ) : refreshing ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mb-4 opacity-50" />
                <p>{searchQuery ? 'No results found for your search' : 'No news found for this category'}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {filteredGroups.map((group) => (
                  <motion.div
                    key={group.source}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    {/* Source Header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-muted/50">
                          <Newspaper className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium text-sm">
                          {group.source}
                        </h3>
                        <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                          {group.total}
                        </span>
                      </div>
                    </div>

                    {/* Articles */}
                    <div className="space-y-2">
                      <AnimatePresence mode="popLayout">
                        {group.articles.map((article, index) => (
                          <motion.div
                            key={article.id}
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ delay: index * 0.02 }}
                          >
                            <NewsCard article={article} />
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>

                    {/* Load More */}
                    {group.hasMore && (
                      <button
                        onClick={() => loadMoreForSource(group.source)}
                        disabled={group.loading}
                        className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/50 disabled:opacity-50"
                      >
                        {group.loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-4 w-4" />
                            Load More ({group.total - group.articles.length} remaining)
                          </>
                        )}
                      </button>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer channelsCount={0} totalUpdates={totalArticles} />

      {/* Floating Genre & Theme Buttons */}
      <div className="fixed bottom-20 right-4 z-50 flex flex-col items-end gap-2">
        <GenreSelector currentGenre={genre} />
        <ThemeToggle />
      </div>
    </div>
  );
}

// Genre Selector Component
function GenreSelector({ currentGenre }: { currentGenre: Genre }) {
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
            {(Object.keys(GENRE_CONFIG) as Genre[]).map((genre) => (
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
          {GENRE_CONFIG[currentGenre]?.icon || GENRE_CONFIG.war.icon}
        </div>
      </Button>
    </div>
  );
}

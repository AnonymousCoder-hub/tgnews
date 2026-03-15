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
import { Loader2, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface GenrePageProps {
  genre: Genre;
}

export function GenrePage({ genre }: GenrePageProps) {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);

  // Track if we've loaded data for this specific genre
  const loadedGenreRef = useMemo(() => ({ current: "" }), []);

  // Fetch data
  const fetchData = useCallback(async (forceRefresh = false) => {
    setRefreshing(true);
    try {
      const url = `/api/news?category=${genre}${forceRefresh ? "&refresh=true" : ""}`;
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setArticles(result.data);
        loadedGenreRef.current = genre;
      }
    } catch (error) {
      console.error('Failed to fetch news:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [genre, loadedGenreRef]);

  // Initial fetch when genre changes
  useEffect(() => {
    // Reset state when genre changes
    setLoading(true);
    setArticles([]);
    fetchData();
  }, [genre]);

  // Track mount for animations
  useEffect(() => {
    setMounted(true);
  }, []);

  // Filter articles by search query
  const filteredArticles = useMemo(() => {
    if (!searchQuery) return articles;

    const query = searchQuery.toLowerCase();
    return articles.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.summary?.toLowerCase().includes(query) ||
        article.source.toLowerCase().includes(query)
    );
  }, [articles, searchQuery]);

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
              <Link href="/war">
                <Button variant="ghost" size="sm">
                  Back to War News
                </Button>
              </Link>
            </div>

            {loading && articles.length === 0 ? (
              <LogoLoader className="relative min-h-[50vh]" />
            ) : loading ? (
              <NewsSkeleton count={5} />
            ) : refreshing ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Globe className="h-12 w-12 mb-4 opacity-50" />
                <p>{searchQuery ? 'No results found for your search' : 'No news found for this category'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredArticles.map((article) => (
                  <NewsCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer channelsCount={0} totalUpdates={filteredArticles.length} />

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

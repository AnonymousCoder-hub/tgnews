"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LIVE_TV_CHANNELS, LIVE_TV_REGIONS } from "@/lib/news-scraper";
import { Radio, ArrowLeft, Tv, ChevronLeft, ChevronRight, Play, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(LIVE_TV_CHANNELS[0]);
  const [selectedRegion, setSelectedRegion] = useState('All');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter channels by region
  const filteredChannels = selectedRegion === 'All' 
    ? LIVE_TV_CHANNELS 
    : LIVE_TV_CHANNELS.filter(ch => {
        if (selectedRegion === 'Americas') return ['USA'].includes(ch.country);
        if (selectedRegion === 'Europe') return ['UK', 'Germany', 'France', 'Europe'].includes(ch.country);
        if (selectedRegion === 'Middle East') return ['Qatar', 'Israel'].includes(ch.country);
        if (selectedRegion === 'Asia') return ['Singapore', 'Japan', 'India'].includes(ch.country);
        return ch.country === selectedRegion;
      });

  // Scroll handlers
  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = direction === 'left' ? -300 : 300;
      scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showWarControls={false}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        <div className="container mx-auto px-4 py-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-red-500/10">
                <Radio className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Live News Streams</h2>
                <p className="text-xs text-muted-foreground">24/7 news from around the world</p>
              </div>
            </div>
            <Link href="/war">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to News
              </Button>
            </Link>
          </div>

          {/* Video Player */}
          <div className="relative group">
            <div className="aspect-video max-w-5xl mx-auto bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-border/50">
              <iframe
                src={selectedChannel.channelUrl}
                title={selectedChannel.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
              
              {/* Live Badge Overlay */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-full text-xs font-semibold shadow-lg">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/70 backdrop-blur-sm text-white rounded-full text-xs font-medium">
                  <span className="text-sm">{selectedChannel.flag}</span>
                  {selectedChannel.name}
                </div>
              </div>
            </div>
          </div>

          {/* Region Filter Pills */}
          <div className="flex items-center justify-center gap-2 flex-wrap">
            {LIVE_TV_REGIONS.map((region) => (
              <button
                key={region}
                onClick={() => setSelectedRegion(region)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  selectedRegion === region
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-muted/50 hover:bg-muted border border-border/50"
                )}
              >
                {region}
              </button>
            ))}
          </div>

          {/* Channel Grid - Horizontal Scroll */}
          <div className="relative">
            {/* Scroll Buttons */}
            <button
              onClick={() => scroll('left')}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-background/90 backdrop-blur-sm rounded-full shadow-lg border border-border/50 hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => scroll('right')}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-background/90 backdrop-blur-sm rounded-full shadow-lg border border-border/50 hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            {/* Channel Cards */}
            <div 
              ref={scrollRef}
              className="flex gap-4 overflow-x-auto pb-4 px-8 scrollbar-hide scroll-smooth"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <AnimatePresence mode="popLayout">
                {filteredChannels.map((channel, index) => (
                  <motion.button
                    key={channel.name}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    onClick={() => setSelectedChannel(channel)}
                    className={cn(
                      "flex-shrink-0 w-[140px] p-4 rounded-2xl transition-all duration-300",
                      "flex flex-col items-center gap-3 group",
                      selectedChannel.name === channel.name
                        ? "bg-primary text-primary-foreground shadow-xl scale-105 ring-2 ring-primary ring-offset-2 ring-offset-background"
                        : "bg-card border border-border/50 hover:border-border hover:shadow-lg hover:scale-102"
                    )}
                  >
                    {/* Flag */}
                    <div className={cn(
                      "text-4xl transition-transform duration-300",
                      selectedChannel.name === channel.name ? "scale-110" : "group-hover:scale-110"
                    )}>
                      {channel.flag}
                    </div>
                    
                    {/* Channel Name */}
                    <div className="text-center">
                      <div className={cn(
                        "font-semibold text-sm",
                        selectedChannel.name === channel.name 
                          ? "text-primary-foreground" 
                          : "text-foreground"
                      )}>
                        {channel.name}
                      </div>
                      <div className={cn(
                        "text-xs mt-0.5",
                        selectedChannel.name === channel.name 
                          ? "text-primary-foreground/70" 
                          : "text-muted-foreground"
                      )}>
                        {channel.country}
                      </div>
                    </div>
                    
                    {/* Play Indicator */}
                    {selectedChannel.name === channel.name && (
                      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2">
                        <div className="flex items-center gap-1 px-2 py-0.5 bg-red-500 text-white rounded-full text-[10px] font-semibold">
                          <Play className="h-2.5 w-2.5 fill-current" />
                          NOW
                        </div>
                      </div>
                    )}
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center justify-center gap-6 pt-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              <span>{LIVE_TV_CHANNELS.length} channels</span>
            </div>
            <div className="flex items-center gap-2">
              <Tv className="h-4 w-4" />
              <span>{new Set(LIVE_TV_CHANNELS.map(c => c.country)).size} countries</span>
            </div>
          </div>
        </div>
      </main>

      <Footer channelsCount={LIVE_TV_CHANNELS.length} totalUpdates={0} />

      {/* Floating Theme Button */}
      <div className="fixed bottom-20 right-4 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}

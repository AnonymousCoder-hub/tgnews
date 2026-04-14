"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LIVE_TV_CHANNELS } from "@/lib/news-scraper";
import { Radio, ArrowLeft, Play } from "lucide-react";
import { motion } from "framer-motion";

export default function LivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(LIVE_TV_CHANNELS[0]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showWarControls={false}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        <div className="container mx-auto px-4 py-6 space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Radio className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Live News</h2>
                <p className="text-xs text-muted-foreground">24/7 streams from around the world</p>
              </div>
            </div>
            <Link href="/war">
              <Button 
                variant="outline" 
                size="sm"
                className="gap-2 h-9"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>

          {/* Video Player */}
          <div className="relative">
            <div className="aspect-video max-w-5xl mx-auto bg-black rounded-2xl overflow-hidden shadow-xl ring-1 ring-border/50">
              <iframe
                src={selectedChannel.channelUrl}
                title={selectedChannel.name}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
              
              {/* Live Badge Overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-red-600 text-white rounded-lg text-xs font-semibold shadow-lg">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/70 backdrop-blur-sm text-white rounded-lg text-xs font-medium">
                  <span>{selectedChannel.icon}</span>
                  <span>{selectedChannel.name}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Channel Selection - Grid on mobile, row on desktop */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:flex md:flex-wrap md:justify-center gap-2">
            {LIVE_TV_CHANNELS.map((channel) => (
              <motion.button
                key={channel.name}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedChannel(channel)}
                className={cn(
                  "px-4 py-2.5 rounded-xl transition-all duration-200",
                  "flex items-center justify-center gap-2",
                  selectedChannel.name === channel.name
                    ? "bg-foreground text-background shadow-lg"
                    : "bg-muted/40 hover:bg-muted border border-transparent hover:border-border/50"
                )}
              >
                <span className="text-base">{channel.icon}</span>
                <span className={cn(
                  "text-sm font-medium",
                  selectedChannel.name === channel.name 
                    ? "text-background" 
                    : "text-foreground"
                )}>
                  {channel.name}
                </span>
                {selectedChannel.name === channel.name && (
                  <Play className="h-3 w-3 fill-current" />
                )}
              </motion.button>
            ))}
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

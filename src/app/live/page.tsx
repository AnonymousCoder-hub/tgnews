"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { LIVE_TV_CHANNELS } from "@/lib/news-scraper";
import { Radio, X, ArrowLeft } from "lucide-react";

export default function LivePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedTVChannel] = useState('Sky News');

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showWarControls={false}
      />

      {/* Main Content */}
      <main className="flex-1 pb-16">
        <div className="container mx-auto px-4 py-6">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Radio className="h-5 w-5 text-red-500" />
                Live News Streams
              </h2>
              <Link href="/war">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="gap-2 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to News
                </Button>
              </Link>
            </div>
            
            {/* Single YouTube Embed */}
            <div className="aspect-video max-w-4xl mx-auto bg-black rounded-2xl overflow-hidden shadow-xl">
              <iframe
                src={LIVE_TV_CHANNELS.find(c => c.name === selectedChannel)?.channelUrl || LIVE_TV_CHANNELS[0].channelUrl}
                title={selectedChannel || 'Live News'}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            
            {/* Channel Selection */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
              {LIVE_TV_CHANNELS.map((channel) => (
                <button
                  key={channel.name}
                  onClick={() => setSelectedTVChannel(channel.name)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200",
                    selectedChannel === channel.name 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "hover:bg-muted/80 border border-border/50 hover:border-border"
                  )}
                >
                  <span className="text-base">{channel.icon}</span>
                  <span>{channel.name}</span>
                  {selectedChannel === channel.name && (
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <Footer channelsCount={0} totalUpdates={0} />

      {/* Floating Theme Button */}
      <div className="fixed bottom-20 right-4 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}

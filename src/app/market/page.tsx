"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import dynamic from 'next/dynamic';
import { Loader2, ArrowLeft } from "lucide-react";

// Dynamic import for Market Monitor
const MarketMonitor = dynamic(() => import('@/components/MarketMonitor'), {
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  ),
  ssr: false,
});

export default function MarketPage() {
  const [searchQuery, setSearchQuery] = useState("");

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
          <div className="flex items-center justify-between mb-6">
            <Link href="/war">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to News
              </Button>
            </Link>
          </div>
          
          <MarketMonitor />
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

"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FooterProps {
  channelsCount?: number;
  totalUpdates?: number;
}

export function Footer({ channelsCount = 0, totalUpdates = 0 }: FooterProps) {
  const [footerVisible, setFooterVisible] = useState(true);
  const lastScrollY = useRef(0);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Smart footer scroll detection
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDiff = currentScrollY - lastScrollY.current;
      
      const nearBottom = window.innerHeight + currentScrollY >= document.documentElement.scrollHeight - 100;
      const nearTop = currentScrollY < 100;
      
      if (nearBottom || nearTop) {
        setFooterVisible(true);
      } else if (scrollDiff > 5) {
        setFooterVisible(true);
      } else if (scrollDiff < -5) {
        setFooterVisible(false);
      }
      
      lastScrollY.current = currentScrollY;
      
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      
      scrollTimeoutRef.current = setTimeout(() => {
        setFooterVisible(true);
      }, 1500);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return (
    <footer 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm transition-transform duration-300 ease-in-out",
        footerVisible ? "translate-y-0" : "translate-y-full"
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2">
            <Link href="/war">
              <img src="/logo.png" alt="newstel" className="h-4 w-4 rounded object-contain cursor-pointer" />
            </Link>
            <span>newstel — Real-time news from trusted Telegram channels</span>
          </span>
          <div className="flex items-center gap-4">
            <span>{channelsCount} channels • {totalUpdates} updates</span>
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              Auto-updates every minute
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}

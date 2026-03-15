"use client";

import { cn } from "@/lib/utils";

interface SkeletonProps {
  count?: number;
}

// Sleek animated logo loader
export function LogoLoader({ className }: { className?: string }) {
  return (
    <div className={cn("fixed inset-0 z-50 flex items-center justify-center bg-background", className)}>
      <div className="flex flex-col items-center gap-5">
        {/* Animated logo container */}
        <div className="relative h-16 w-16">
          {/* Outer rotating ring with gradient */}
          <div 
            className="absolute inset-0 rounded-2xl animate-spin"
            style={{ 
              animationDuration: '1.5s',
              background: `conic-gradient(from 0deg, transparent 0%, transparent 65%, hsl(var(--primary)) 85%, transparent 100%)`,
              padding: '3px',
            }}
          >
            <div className="h-full w-full rounded-2xl bg-background" />
          </div>
          
          {/* Inner glow */}
          <div className="absolute inset-1 rounded-xl bg-gradient-to-br from-primary/5 to-transparent" />
          
          {/* Logo */}
          <div className="absolute inset-1 flex items-center justify-center">
            <img
              src="/logo.png"
              alt="newstel"
              className="h-12 w-12 rounded-xl object-contain"
            />
          </div>
        </div>
        
        {/* Loading text */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground font-medium">Loading</span>
          <div className="flex items-center gap-1">
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-[bounce_1s_ease-in-out_infinite]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-[bounce_1s_ease-in-out_0.2s_infinite]" />
            <span className="h-1 w-1 rounded-full bg-muted-foreground animate-[bounce_1s_ease-in-out_0.4s_infinite]" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function MessageSkeleton({ count = 6 }: SkeletonProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card overflow-hidden"
        >
          {/* Channel header */}
          <div className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-muted/40 overflow-hidden relative">
              <Shimmer />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 bg-muted/40 rounded relative overflow-hidden">
                <Shimmer />
              </div>
              <div className="h-3 w-16 bg-muted/40 rounded relative overflow-hidden">
                <Shimmer />
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="px-4 pb-4 space-y-3">
            <div className="space-y-2">
              <div className="h-3 w-full bg-muted/40 rounded relative overflow-hidden">
                <Shimmer />
              </div>
              <div className="h-3 w-5/6 bg-muted/40 rounded relative overflow-hidden">
                <Shimmer />
              </div>
              <div className="h-3 w-4/6 bg-muted/40 rounded relative overflow-hidden">
                <Shimmer />
              </div>
            </div>

            {/* Media placeholder */}
            <div className="h-40 w-full bg-muted/40 rounded-lg relative overflow-hidden">
              <Shimmer />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewsSkeleton({ count = 5 }: SkeletonProps) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border bg-card p-4 relative overflow-hidden"
        >
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 rounded bg-muted/40 relative overflow-hidden">
                  <Shimmer />
                </div>
                <div className="h-4 w-24 bg-muted/40 rounded relative overflow-hidden">
                  <Shimmer />
                </div>
              </div>
              <div className="h-5 w-3/4 bg-muted/40 rounded relative overflow-hidden">
                <Shimmer />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full bg-muted/40 rounded relative overflow-hidden">
                  <Shimmer />
                </div>
                <div className="h-3 w-5/6 bg-muted/40 rounded relative overflow-hidden">
                  <Shimmer />
                </div>
              </div>
            </div>
            <div className="h-20 w-20 bg-muted/40 rounded-lg flex-shrink-0 relative overflow-hidden">
              <Shimmer />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Smooth shimmer animation component
function Shimmer() {
  return (
    <div 
      className="absolute inset-0 -translate-x-full animate-[shimmer_2.5s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent"
      style={{ 
        minWidth: '100%',
        animationTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)'
      }}
    />
  );
}

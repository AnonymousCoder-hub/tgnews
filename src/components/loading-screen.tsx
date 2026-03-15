"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  dataLoaded: boolean;
}

export function LoadingScreen({ dataLoaded }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [showJustAMoment, setShowJustAMoment] = useState(false);
  
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          if (dataLoaded) {
            return Math.min(prev + 2, 100);
          }
          return Math.min(prev + 0.3, 98);
        }
        const increment = Math.random() * 5 + 4;
        return Math.min(prev + increment, 90);
      });
    }, 100);
    
    return () => clearInterval(progressInterval);
  }, [dataLoaded]);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!dataLoaded) {
        setShowJustAMoment(true);
      }
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [dataLoaded]);
  
  const getStatusText = () => {
    if (progress >= 100) return "Loaded successfully!";
    if (showJustAMoment && progress >= 90) return "Just a moment...";
    if (progress >= 75) return "Almost ready...";
    if (progress >= 50) return "Getting latest news...";
    if (progress >= 25) return "Fetching channels...";
    return "Connecting to feed...";
  };
  
  const isComplete = progress >= 100;
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6 w-72 px-4">
        <div className={cn(
          "relative transition-all duration-500",
          isComplete && "scale-110"
        )}>
          <img 
            src="/logo.png" 
            alt="newstel" 
            className="h-16 w-16 rounded-2xl object-contain"
          />
          {isComplete && (
            <div className="absolute inset-0 rounded-2xl bg-green-500/20 animate-ping" />
          )}
        </div>
        
        <div className="w-full space-y-3">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-150 ease-out",
                isComplete 
                  ? "bg-gradient-to-r from-green-500 to-emerald-500" 
                  : "bg-gradient-to-r from-primary to-primary/70"
              )}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          
          <div className="flex items-center justify-center gap-2">
            <span className={cn(
              "text-sm font-medium transition-all duration-300",
              isComplete ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
            )}>
              {getStatusText()}
            </span>
          </div>
        </div>
        
        <div className={cn(
          "text-xs tabular-nums font-mono transition-all duration-200",
          isComplete ? "text-green-500" : "text-muted-foreground/60"
        )}>
          {Math.round(Math.min(progress, 100))}%
        </div>
      </div>
    </div>
  );
}

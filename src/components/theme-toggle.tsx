"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { THEMES, ThemeName, applyTheme, getSavedTheme } from "@/lib/themes";

const THEME_ORDER: ThemeName[] = ['dark', 'cyberpunk', 'terminal', 'midnight', 'military', 'synthwave'];

export function ThemeToggle() {
  // Initialize with saved theme using lazy initializer
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = getSavedTheme();
    applyTheme(saved);
    return saved;
  });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Apply theme on mount and set mounted flag
    applyTheme(currentTheme);
    requestAnimationFrame(() => setMounted(true));
     
  }, []);

  const cycleTheme = () => {
    const currentIndex = THEME_ORDER.indexOf(currentTheme);
    const nextIndex = (currentIndex + 1) % THEME_ORDER.length;
    const nextTheme = THEME_ORDER[nextIndex];
    setCurrentTheme(nextTheme);
    applyTheme(nextTheme);
  };

  if (!mounted) {
    return (
      <Button
        variant="outline"
        size="icon"
        className="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm"
      >
        <span className="text-lg">🌙</span>
      </Button>
    );
  }

  const theme = THEMES[currentTheme];

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={cycleTheme}
      className="h-10 w-10 rounded-full shadow-lg bg-background/80 backdrop-blur-sm hover:bg-accent"
      title={`Current: ${theme.label} - Click to change`}
    >
      <span className="text-lg">{theme.icon}</span>
    </Button>
  );
}

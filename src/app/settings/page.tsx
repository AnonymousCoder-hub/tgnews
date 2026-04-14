"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { THEMES, ThemeName, applyTheme, getSavedTheme } from "@/lib/themes";
import {
  ArrowLeft,
  Palette,
  Check,
  GripVertical,
  Settings2,
  Zap,
  Globe,
  Cpu,
  Trophy,
  Heart,
  Coins,
  Film,
  Atom,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getPreferences,
  savePreferences,
  UserPreferences,
  ALL_CATEGORIES,
  CATEGORY_SOURCES,
} from "@/lib/user-preferences";

// Icon mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  war: <Zap className="h-4 w-4" />,
  world: <Globe className="h-4 w-4" />,
  technology: <Cpu className="h-4 w-4" />,
  sports: <Trophy className="h-4 w-4" />,
  health: <Heart className="h-4 w-4" />,
  business: <Coins className="h-4 w-4" />,
  entertainment: <Film className="h-4 w-4" />,
  science: <Atom className="h-4 w-4" />,
};

export default function SettingsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  // Initialize theme and preferences with lazy initializers
  const [currentTheme, setCurrentTheme] = useState<ThemeName>(() => {
    if (typeof window === 'undefined') return 'dark';
    const saved = getSavedTheme();
    applyTheme(saved);
    return saved;
  });
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => {
    if (typeof window === 'undefined') return null;
    return getPreferences();
  });
  const [activeGenre, setActiveGenre] = useState<string>(() => {
    if (typeof window === 'undefined') return 'war';
    const prefs = getPreferences();
    return prefs.defaultCategory;
  });
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Apply theme on mount
  useEffect(() => {
    applyTheme(currentTheme);
     
  }, []);

  const handleThemeChange = (themeName: ThemeName) => {
    setCurrentTheme(themeName);
    applyTheme(themeName);
    if (preferences) {
      savePreferences({ ...preferences, theme: themeName });
    }
  };

  // Get ordered categories
  const orderedCategories = useMemo(() => {
    if (!preferences) return ALL_CATEGORIES;
    const order = preferences.categoryOrder;
    const ordered = order
      .map((id) => ALL_CATEGORIES.find((c) => c.id === id))
      .filter(Boolean) as typeof ALL_CATEGORIES;
    // Add any new categories not in the order
    const missing = ALL_CATEGORIES.filter((c) => !order.includes(c.id));
    return [...ordered, ...missing];
  }, [preferences]);

  // Drag and drop handlers for categories
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex || !preferences) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...preferences.categoryOrder];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    const updated = { ...preferences, categoryOrder: newOrder };
    setPreferences(updated);
    savePreferences(updated);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleCategoryToggle = (categoryId: string) => {
    if (!preferences) return;
    const enabled = preferences.enabledCategories.includes(categoryId);
    const updated = {
      ...preferences,
      enabledCategories: enabled
        ? preferences.enabledCategories.filter((c) => c !== categoryId)
        : [...preferences.enabledCategories, categoryId],
    };
    setPreferences(updated);
    savePreferences(updated);
  };

  const handleSourceToggle = (category: string, sourceId: string) => {
    if (!preferences) return;
    const categorySources = preferences.categorySources[category] || {
      enabled: [],
      order: [],
    };
    const isEnabled = categorySources.enabled.includes(sourceId);
    const updated = {
      ...preferences,
      categorySources: {
        ...preferences.categorySources,
        [category]: {
          enabled: isEnabled
            ? categorySources.enabled.filter((s) => s !== sourceId)
            : [...categorySources.enabled, sourceId],
          order: categorySources.order,
        },
      },
    };
    setPreferences(updated);
    savePreferences(updated);
  };

  const handleSelectAllSources = (category: string) => {
    if (!preferences) return;
    const allSources = CATEGORY_SOURCES[category]?.map((s) => s.id) || [];
    const updated = {
      ...preferences,
      categorySources: {
        ...preferences.categorySources,
        [category]: {
          enabled: allSources,
          order: allSources,
        },
      },
    };
    setPreferences(updated);
    savePreferences(updated);
  };

  // Get sources for active genre
  const sourcesForGenre = CATEGORY_SOURCES[activeGenre] || [];
  const genreSourcePrefs = preferences?.categorySources[activeGenre] || {
    enabled: [],
    order: [],
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showWarControls={false}
      />

      <main className="flex-1 pb-16">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-primary/10 rounded-lg">
                <Settings2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Settings</h1>
                <p className="text-sm text-muted-foreground">
                  Customize your experience
                </p>
              </div>
            </div>
            <Link href={`/${preferences?.defaultCategory || "war"}`}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>

          {/* Theme Selection - Compact with mini preview cards */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Theme</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
              {Object.values(THEMES).map((theme) => (
                <button
                  key={theme.name}
                  onClick={() => handleThemeChange(theme.name)}
                  className={cn(
                    "relative group overflow-hidden rounded-lg border-2 transition-all duration-200",
                    currentTheme === theme.name
                      ? "border-primary shadow-md shadow-primary/20"
                      : "border-transparent hover:border-border"
                  )}
                >
                  {/* Mini preview card */}
                  <div
                    className="aspect-[3/2] relative"
                    style={{
                      background: theme.gradient
                        ? `linear-gradient(${theme.gradient.angle || "180deg"}, ${theme.gradient.from}, ${theme.gradient.to})`
                        : theme.colors.background,
                    }}
                  >
                    {/* Scanlines */}
                    {theme.effects.scanlines && (
                      <div
                        className="absolute inset-0 opacity-30"
                        style={{
                          background: "linear-gradient(rgba(0,0,0,0) 50%, rgba(0,0,0,0.3) 50%)",
                          backgroundSize: "100% 2px",
                        }}
                      />
                    )}
                    
                    {/* Grid */}
                    {theme.effects.gridOverlay && (
                      <div
                        className="absolute inset-0 opacity-20"
                        style={{
                          backgroundImage: `linear-gradient(${theme.colors.accent}40 1px, transparent 1px), linear-gradient(90deg, ${theme.colors.accent}40 1px, transparent 1px)`,
                          backgroundSize: "8px 8px",
                        }}
                      />
                    )}

                    {/* Mini UI elements */}
                    <div className="absolute inset-0 p-1.5 flex flex-col gap-1">
                      <div
                        className="h-2 rounded-sm"
                        style={{ background: theme.colors.primary }}
                      />
                      <div className="flex-1 flex gap-1">
                        <div
                          className="flex-1 rounded-sm p-1 space-y-0.5"
                          style={{ background: `${theme.colors.card}80` }}
                        >
                          <div
                            className="h-1 w-3/4 rounded-sm"
                            style={{ background: theme.colors.accent }}
                          />
                          <div
                            className="h-0.5 w-full rounded-sm"
                            style={{ background: `${theme.colors.mutedForeground}30` }}
                          />
                        </div>
                        <div
                          className="flex-1 rounded-sm"
                          style={{ background: `${theme.colors.card}60` }}
                        />
                      </div>
                    </div>

                    {/* Selected check */}
                    {currentTheme === theme.name && (
                      <div
                        className="absolute top-1 right-1 p-0.5 rounded-full"
                        style={{ background: theme.colors.primary }}
                      >
                        <Check className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div
                    className="p-1.5 flex items-center justify-center gap-1"
                    style={{ background: `${theme.colors.card}50` }}
                  >
                    <span className="text-xs">{theme.icon}</span>
                    <span
                      className="text-[10px] font-medium truncate"
                      style={{ color: theme.colors.foreground }}
                    >
                      {theme.label}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Category Order */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <GripVertical className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Category Order</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Drag to reorder. Click toggle to show/hide in menu.
            </p>

            {preferences && (
              <div className="space-y-1.5">
                {orderedCategories.map((category, index) => {
                  const isEnabled = preferences.enabledCategories.includes(category.id);
                  const isDragging = draggedIndex === index;
                  const isDragOver = dragOverIndex === index;
                  
                  return (
                    <div
                      key={category.id}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      onDragEnd={handleDragEnd}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 cursor-grab active:cursor-grabbing",
                        isEnabled ? "bg-card border-border" : "bg-muted/20 border-border/30 opacity-50",
                        isDragging && "opacity-50 scale-[0.98]",
                        isDragOver && !isDragging && "border-primary border-dashed bg-primary/5"
                      )}
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div
                        className={cn(
                          "p-1.5 rounded-md",
                          isEnabled ? "bg-primary/10 text-primary" : "bg-muted"
                        )}
                      >
                        {CATEGORY_ICONS[category.id]}
                      </div>
                      <span
                        className={cn(
                          "flex-1 text-sm font-medium",
                          !isEnabled && "text-muted-foreground"
                        )}
                      >
                        {category.label}
                      </span>
                      <button
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          "w-10 h-5 rounded-full transition-colors relative flex-shrink-0",
                          isEnabled ? "bg-primary" : "bg-muted"
                        )}
                      >
                        <motion.div
                          layout
                          className={cn(
                            "absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all",
                            isEnabled ? "left-5" : "left-0.5"
                          )}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Source Selection per Genre */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Palette className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">News Sources</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Select sources for each category.
            </p>

            {/* Genre Tabs */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {orderedCategories
                .filter((c) => preferences?.enabledCategories.includes(c.id))
                .map((category) => (
                  <button
                    key={category.id}
                    onClick={() => setActiveGenre(category.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      activeGenre === category.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-muted/80"
                    )}
                  >
                    {CATEGORY_ICONS[category.id]}
                    {category.label}
                  </button>
                ))}
            </div>

            {/* Sources for active genre */}
            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted/30 px-4 py-2 flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  {orderedCategories.find((c) => c.id === activeGenre)?.label} Sources
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {genreSourcePrefs.enabled.length || sourcesForGenre.length} selected
                  </span>
                  <button
                    onClick={() => handleSelectAllSources(activeGenre)}
                    className="text-xs text-primary hover:underline"
                  >
                    Select All
                  </button>
                </div>
              </div>

              <div className="p-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {sourcesForGenre.map((source) => {
                  const isEnabled = genreSourcePrefs.enabled.length === 0 
                    ? true 
                    : genreSourcePrefs.enabled.includes(source.id);
                  return (
                    <button
                      key={source.id}
                      onClick={() => handleSourceToggle(activeGenre, source.id)}
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg transition-all text-left",
                        isEnabled ? "bg-muted/30" : "opacity-40"
                      )}
                    >
                      <div
                        className={cn(
                          "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0",
                          isEnabled ? "border-primary bg-primary" : "border-muted-foreground/30"
                        )}
                      >
                        {isEnabled && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span className={cn("text-sm", !isEnabled && "text-muted-foreground")}>
                        {source.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* Reset Preferences */}
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Settings2 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">Reset</h2>
            </div>
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/20">
              <div>
                <p className="text-sm font-medium">Reset All Preferences</p>
                <p className="text-xs text-muted-foreground">Clear all settings and show setup popup again</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  localStorage.removeItem('newstel-preferences');
                  window.location.href = '/';
                }}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                Reset
              </Button>
            </div>
          </section>
        </div>
      </main>

      <Footer channelsCount={0} totalUpdates={0} />

      {/* Floating Theme Toggle */}
      <div className="fixed bottom-20 right-4 z-50">
        <ThemeToggle />
      </div>
    </div>
  );
}

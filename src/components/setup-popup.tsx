"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ALL_CATEGORIES,
  CATEGORY_SOURCES,
  UserPreferences,
  DEFAULT_PREFERENCES,
  completeSetup,
} from "@/lib/user-preferences";
import { Zap, Globe, Cpu, Trophy, Heart, Coins, Film, Atom, Check, ChevronRight, X, Sparkles } from "lucide-react";

// Icon mapping
const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  war: <Zap className="h-5 w-5" />,
  world: <Globe className="h-5 w-5" />,
  technology: <Cpu className="h-5 w-5" />,
  sports: <Trophy className="h-5 w-5" />,
  health: <Heart className="h-5 w-5" />,
  business: <Coins className="h-5 w-5" />,
  entertainment: <Film className="h-5 w-5" />,
  science: <Atom className="h-5 w-5" />,
};

interface SetupPopupProps {
  onComplete: () => void;
}

export function SetupPopup({ onComplete }: SetupPopupProps) {
  const [step, setStep] = useState(0); // 0: welcome, 1: category, 2: sources
  const [activeCategory, setActiveCategory] = useState<string>(DEFAULT_PREFERENCES.defaultCategory); // For source selection view
  const [preferences, setPreferences] = useState<Partial<UserPreferences>>({
    defaultCategory: DEFAULT_PREFERENCES.defaultCategory,
    enabledCategories: [...DEFAULT_PREFERENCES.enabledCategories],
    categorySources: {},
  });

  const handleCategorySelect = (categoryId: string) => {
    setPreferences((prev) => ({
      ...prev,
      defaultCategory: categoryId,
    }));
  };

  const handleCategoryToggle = (categoryId: string) => {
    setPreferences((prev) => {
      const enabled = prev.enabledCategories || [];
      const isEnabled = enabled.includes(categoryId);
      return {
        ...prev,
        enabledCategories: isEnabled
          ? enabled.filter((c) => c !== categoryId)
          : [...enabled, categoryId],
      };
    });
  };

  const handleSourceToggle = (category: string, sourceId: string) => {
    setPreferences((prev) => {
      const categorySources = prev.categorySources || {};
      const current = categorySources[category] || { enabled: [], order: [] };
      const isEnabled = current.enabled.includes(sourceId);

      return {
        ...prev,
        categorySources: {
          ...categorySources,
          [category]: {
            enabled: isEnabled
              ? current.enabled.filter((s) => s !== sourceId)
              : [...current.enabled, sourceId],
            order: current.order,
          },
        },
      };
    });
  };

  const handleSelectAllSources = (category: string) => {
    const allSources = CATEGORY_SOURCES[category]?.map((s) => s.id) || [];
    setPreferences((prev) => {
      const categorySources = prev.categorySources || {};
      return {
        ...prev,
        categorySources: {
          ...categorySources,
          [category]: {
            enabled: allSources,
            order: allSources,
          },
        },
      };
    });
  };

  const handleSkip = () => {
    completeSetup({});
    onComplete();
  };

  const handleComplete = () => {
    completeSetup(preferences);
    onComplete();
  };

  const selectedCategory = ALL_CATEGORIES.find((c) => c.id === preferences.defaultCategory);
  // For step 2, show sources for the active category being viewed
  const sourcesForCategory = CATEGORY_SOURCES[activeCategory] || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="relative w-full max-w-2xl bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
            <button
              onClick={handleSkip}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Progress dots */}
            <div className="flex items-center gap-1.5 mb-4">
              {[0, 1, 2].map((s) => (
                <div
                  key={s}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    s === step
                      ? "w-8 bg-primary"
                      : s < step
                      ? "w-1.5 bg-primary/50"
                      : "w-1.5 bg-muted"
                  )}
                />
              ))}
            </div>

            {step === 0 && (
              <div>
                <h2 className="text-2xl font-bold">Welcome to newstel</h2>
                <p className="text-muted-foreground mt-1">
                  Let&apos;s personalize your news experience
                </p>
              </div>
            )}

            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold">Choose your interests</h2>
                <p className="text-muted-foreground mt-1">
                  Select your default category and which ones to show
                </p>
              </div>
            )}

            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold">Select sources</h2>
                <p className="text-muted-foreground mt-1">
                  Choose news sources for {selectedCategory?.label || "your categories"}
                </p>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {/* Step 0: Welcome */}
            {step === 0 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-center py-8"
              >
                <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Stay informed, your way</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Newstel brings you real-time news from trusted sources. 
                  Set up your preferences for a personalized experience.
                </p>
              </motion.div>
            )}

            {/* Step 1: Category Selection */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Default Category */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">
                    Default Homepage
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {ALL_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={cn(
                          "relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all",
                          preferences.defaultCategory === category.id
                            ? "border-primary bg-primary/5 shadow-lg shadow-primary/10"
                            : "border-border/50 hover:border-border hover:bg-muted/30"
                        )}
                      >
                        <div
                          className={cn(
                            "p-2 rounded-lg",
                            preferences.defaultCategory === category.id
                              ? "bg-primary/10 text-primary"
                              : "bg-muted/50 text-muted-foreground"
                          )}
                        >
                          {CATEGORY_ICONS[category.id]}
                        </div>
                        <span className="text-xs font-medium">{category.label}</span>
                        {preferences.defaultCategory === category.id && (
                          <div className="absolute top-1 right-1 p-0.5 bg-primary rounded-full">
                            <Check className="h-3 w-3 text-primary-foreground" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Enabled Categories */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-3 block">
                    Show in Menu (tap to toggle)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {ALL_CATEGORIES.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full border transition-all",
                          preferences.enabledCategories?.includes(category.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border/50 text-muted-foreground hover:border-border"
                        )}
                      >
                        {CATEGORY_ICONS[category.id]}
                        <span className="text-sm font-medium">{category.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: Source Selection */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="space-y-6"
              >
                {/* Category tabs - uses local state for viewing, NOT defaultCategory */}
                <div className="flex flex-wrap gap-2">
                  {ALL_CATEGORIES.filter((c) =>
                    preferences.enabledCategories?.includes(c.id)
                  ).map((category) => (
                    <button
                      key={category.id}
                      onClick={() =>
                        setActiveCategory(category.id)
                      }
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all",
                        activeCategory === category.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted hover:bg-muted/80"
                      )}
                    >
                      {CATEGORY_ICONS[category.id]}
                      {category.label}
                    </button>
                  ))}
                </div>

                {/* Sources grid */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-muted-foreground">
                      Sources for {ALL_CATEGORIES.find(c => c.id === activeCategory)?.label}
                    </label>
                    <button
                      onClick={() => handleSelectAllSources(activeCategory)}
                      className="text-xs text-primary hover:underline"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {sourcesForCategory.map((source) => {
                      const isEnabled =
                        preferences.categorySources?.[activeCategory]?.enabled?.includes(source.id) ?? true;
                      return (
                        <button
                          key={source.id}
                          onClick={() => handleSourceToggle(activeCategory, source.id)}
                          className={cn(
                            "flex items-center gap-2 p-3 rounded-lg border text-left transition-all",
                            isEnabled
                              ? "border-primary/50 bg-primary/5"
                              : "border-border/50 opacity-50"
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border-2 flex items-center justify-center transition-colors",
                              isEnabled
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/30"
                            )}
                          >
                            {isEnabled && <Check className="h-3 w-3 text-primary-foreground" />}
                          </div>
                          <span className="text-sm font-medium truncate">{source.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between">
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip setup
            </button>

            <div className="flex items-center gap-3">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(step - 1)}>
                  Back
                </Button>
              )}
              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)}>
                  Continue
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleComplete}>
                  Get Started
                  <Sparkles className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getPreferences, UserPreferences } from "@/lib/user-preferences";
import { SetupPopup } from "@/components/setup-popup";

export default function RootPage() {
  const router = useRouter();
  // Initialize preferences with lazy initializer
  const [preferences, setPreferences] = useState<UserPreferences | null>(() => {
    if (typeof window === 'undefined') return null;
    return getPreferences();
  });

  useEffect(() => {
    // If we already have preferences and setup is completed, redirect
    if (preferences?.setupCompleted) {
      router.replace(`/${preferences.defaultCategory}`);
    }
  }, [preferences?.setupCompleted, preferences?.defaultCategory, router]);

  const handleSetupComplete = () => {
    const prefs = getPreferences();
    setPreferences(prefs);
    router.replace(`/${prefs.defaultCategory}`);
  };

  // Show setup popup if not completed
  if (preferences && !preferences.setupCompleted) {
    return <SetupPopup onComplete={handleSetupComplete} />;
  }

  // Loading state (null preferences or redirecting)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/logo.png"
          alt="newstel"
          className="h-12 w-12 rounded-xl object-contain animate-pulse"
        />
      </div>
    </div>
  );
}

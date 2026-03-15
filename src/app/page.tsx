"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    // Immediately redirect to war page
    router.replace('/war');
  }, [router]);

  // Show minimal loading while redirecting
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

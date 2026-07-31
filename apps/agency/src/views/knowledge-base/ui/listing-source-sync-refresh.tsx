"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ListingSourceSyncRefresh({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [, startRefresh] = useTransition();

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const intervalId = window.setInterval(() => {
      startRefresh(() => router.refresh());
    }, 2500);

    return () => window.clearInterval(intervalId);
  }, [enabled, router]);

  return null;
}

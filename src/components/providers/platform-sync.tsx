"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";

export function PlatformSync() {
  useEffect(() => {
    void useAppStore.getState().hydrateFromServer();
  }, []);

  return null;
}
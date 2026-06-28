"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";

export function AuthSync() {
  useEffect(() => {
    async function syncAuth() {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();

        if (data.authenticated && data.user?.id) {
          useAppStore.getState().setCurrentUser(data.user.id);
        }
      } catch {
        // Demo mode or offline — keep existing local user.
      }
    }

    void syncAuth();
  }, []);

  return null;
}
"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store/app-store";
import type { User } from "@/lib/types";

export function AuthSync() {
  useEffect(() => {
    async function syncAuth() {
      try {
        const meRes = await fetch("/api/auth/me", { credentials: "same-origin" });
        const me = await meRes.json();

        await useAppStore.getState().hydrateFromServer();

        if (me.authenticated && me.user?.id) {
          const store = useAppStore.getState();
          const exists = store.users.some((u) => u.id === me.user.id);
          if (!exists && me.user.email) {
            const hydratedUser: User = {
              id: me.user.id,
              orgId: me.user.orgId,
              teamId:
                me.user.teamId ||
                store.teams.find((t) => t.orgId === me.user.orgId)?.id ||
                "",
              name: me.user.name,
              email: me.user.email,
              phone: me.user.phone,
              role: me.user.role,
              avatarInitials: me.user.name
                .split(/\s+/)
                .map((p: string) => p[0]?.toUpperCase() ?? "")
                .join("")
                .slice(0, 2) || "??",
              priorityCategories: [],
            };
            store.mergePlatformData({ users: [hydratedUser] });
          }
          useAppStore.getState().setCurrentUser(me.user.id);
        }
      } catch {
        // Offline or demo mode
      }
    }

    void syncAuth();
  }, []);

  return null;
}
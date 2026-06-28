"use client";

import { useEffect, useState } from "react";
import type { User, UserRole } from "@/lib/types";

export type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | {
      status: "authenticated";
      user: {
        id: string;
        name: string;
        email: string;
        role: UserRole;
        orgId: string;
      };
    };

export function useSession(): SessionState {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "same-origin" });
        const data = await res.json();
        if (cancelled) return;

        if (data.authenticated && data.user?.id) {
          setSession({
            status: "authenticated",
            user: {
              id: data.user.id,
              name: data.user.name,
              email: data.user.email,
              role: data.user.role,
              orgId: data.user.orgId,
            },
          });
          return;
        }

        setSession({ status: "anonymous" });
      } catch {
        if (!cancelled) setSession({ status: "anonymous" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return session;
}

export function dashboardPathForRole(role: UserRole): string {
  return role === "manager" ? "/manager" : "/staff";
}
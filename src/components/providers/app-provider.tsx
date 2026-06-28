"use client";

/** 
 * Client-only wrapper (no blocking spinner).
 * We render children immediately so the UI shows without waiting.
 * Zustand persist rehydrates in the background.
 */
export function AppProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
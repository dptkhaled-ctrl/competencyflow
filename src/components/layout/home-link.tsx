"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Shows a subtle home link on inner pages (not on welcome screen). */
export function HomeLink() {
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <Link
      href="/"
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      ← Welcome
    </Link>
  );
}
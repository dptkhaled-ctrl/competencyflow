"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  dashboardPathForRole,
  useSession,
} from "@/lib/store/session-hooks";

export function HomeLink() {
  const pathname = usePathname();
  const session = useSession();

  if (pathname === "/" || pathname === "/login") return null;

  if (session.status === "authenticated") {
    const href = dashboardPathForRole(session.user.role);
    if (pathname.startsWith(href)) return null;
    return (
      <Link
        href={href}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Dashboard
      </Link>
    );
  }

  return (
    <Link
      href="/"
      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      ← Home
    </Link>
  );
}
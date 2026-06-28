"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";
import { HomeLink } from "@/components/layout/home-link";
import { RoleSwitcher } from "@/components/layout/role-switcher";
import { useCurrentUser } from "@/lib/store/hooks";

export function AppHeader() {
  const user = useCurrentUser();
  const homeHref = user.role === "manager" ? "/manager" : "/staff";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href={homeHref} className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <span className="hidden sm:inline">CompetencyFlow</span>
        </Link>
        <div className="flex items-center gap-3">
          <HomeLink />
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
}
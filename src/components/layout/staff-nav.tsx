"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Bot, Home } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/staff", label: "Home", icon: Home, exact: true },
  { href: "/staff/learn", label: "Learn", icon: BookOpen },
  { href: "/staff/tutor", label: "Coach", icon: Bot },
  { href: "/staff/stats", label: "Stats", icon: BarChart3 },
];

function NavTab({
  href,
  label,
  icon: Icon,
  exact,
  pathname,
  variant,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  exact?: boolean;
  pathname: string;
  variant: "mobile" | "desktop";
}) {
  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);

  if (variant === "desktop") {
    return (
      <Link
        href={href}
        className={cn(
          "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-colors",
          active
            ? "bg-indigo-600 text-white shadow-sm"
            : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-700"
        )}
      >
        <Icon className={cn("h-4 w-4", active && "stroke-[2.5]")} />
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-0.5 rounded-xl px-4 py-1.5 text-[10px] font-semibold transition-colors",
        active
          ? "text-indigo-600 bg-indigo-50"
          : "text-slate-400 hover:text-slate-600"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
      {label}
    </Link>
  );
}

export function StaffNav() {
  const pathname = usePathname();

  return (
    <>
      <nav className="sticky top-14 z-30 hidden border-b border-indigo-100/80 bg-white/90 backdrop-blur-md md:block">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-4 py-3">
          {TABS.map((tab) => (
            <NavTab key={tab.href} {...tab} pathname={pathname} variant="desktop" />
          ))}
        </div>
      </nav>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-indigo-100/80 bg-white/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
          {TABS.map((tab) => (
            <NavTab key={tab.href} {...tab} pathname={pathname} variant="mobile" />
          ))}
        </div>
      </nav>
    </>
  );
}
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bot, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/manager", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manager/training", label: "Training", icon: BookOpen },
  { href: "/manager/team", label: "Team", icon: Users },
  { href: "/manager/chat", label: "Competency AI", icon: Bot },
];

export function ManagerNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1 border-b px-4 -mb-px">
      {links.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/manager"
            ? pathname === "/manager"
            : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
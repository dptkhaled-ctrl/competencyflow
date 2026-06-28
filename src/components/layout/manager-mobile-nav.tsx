"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Bot, LayoutDashboard, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/manager", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/manager/training", label: "Training", icon: BookOpen },
  { href: "/manager/team", label: "Team", icon: Users },
  { href: "/manager/chat", label: "Competency AI", icon: Bot },
];

export function ManagerMobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur md:hidden">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-2">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-col items-center gap-0.5 rounded-lg px-3 py-1.5 text-[10px] font-medium",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
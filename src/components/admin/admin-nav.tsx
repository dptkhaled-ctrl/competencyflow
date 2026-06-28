"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Database,
  FileUp,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/organizations", label: "Organizations", icon: Building2 },
  { href: "/admin/invites", label: "Invite managers", icon: Mail },
  { href: "/admin/database", label: "People & Orgs", icon: Database },
  { href: "/admin/upload", label: "Upload", icon: FileUp },
  { href: "/admin/files", label: "Files", icon: FolderOpen },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="mr-3 hidden shrink-0 text-sm font-bold text-amber-400 sm:inline">
            CompetencyFlow
          </span>
          {LINKS.map(({ href, label, icon: Icon, exact }) => {
            const active = exact
              ? pathname === href
              : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                prefetch
                className={cn(
                  "relative z-10 flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors pointer-events-auto",
                  active
                    ? "bg-amber-500/15 text-amber-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            );
          })}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={logout}
          className="shrink-0 text-slate-400 hover:text-slate-200"
        >
          <LogOut className="h-4 w-4" />
          <span className="hidden sm:inline">Logout</span>
        </Button>
      </div>
    </header>
  );
}
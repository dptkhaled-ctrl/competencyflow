"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";
import { ManagerMobileNav } from "@/components/layout/manager-mobile-nav";
import { ManagerNav } from "@/components/layout/manager-nav";
import {
  dashboardPathForRole,
  useSession,
} from "@/lib/store/session-hooks";
import { useAppStore } from "@/lib/store/app-store";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === "loading") return;
    if (session.status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (session.user.role !== "manager") {
      router.replace(dashboardPathForRole(session.user.role));
      return;
    }
    useAppStore.getState().setCurrentUser(session.user.id);
  }, [session, router]);

  if (session.status === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (session.status === "anonymous" || session.user.role !== "manager") {
    return null;
  }

  return (
    <>
      <TutorialOverlay role="manager" />
      <div className="mx-auto max-w-6xl px-4 py-6 pb-24 md:pb-6">
        <ManagerNav />
        <div className="mt-6">{children}</div>
      </div>
      <ManagerMobileNav />
    </>
  );
}
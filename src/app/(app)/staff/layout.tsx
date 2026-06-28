"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";
import {
  dashboardPathForRole,
  useSession,
} from "@/lib/store/session-hooks";
import { useAppStore } from "@/lib/store/app-store";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    if (session.status === "loading") return;
    if (session.status === "anonymous") {
      router.replace("/login");
      return;
    }
    if (session.user.role !== "staff") {
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

  if (session.status === "anonymous" || session.user.role !== "staff") {
    return null;
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-2 md:max-w-xl">
      <TutorialOverlay role="staff" />
      {children}
    </div>
  );
}
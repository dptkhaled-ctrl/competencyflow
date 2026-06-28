"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";
import { ManagerMobileNav } from "@/components/layout/manager-mobile-nav";
import { ManagerNav } from "@/components/layout/manager-nav";
import { useCurrentUser } from "@/lib/store/hooks";

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.role !== "manager") router.replace("/staff");
  }, [user.role, router]);

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
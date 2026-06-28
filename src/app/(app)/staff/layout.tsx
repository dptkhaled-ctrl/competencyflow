"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { TutorialOverlay } from "@/components/tutorial/tutorial-overlay";
import { useCurrentUser } from "@/lib/store/hooks";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useCurrentUser();

  useEffect(() => {
    if (user.role !== "staff") router.replace("/manager");
  }, [user.role, router]);

  return (
    <div className="mx-auto max-w-lg px-4 pb-6 pt-2 md:max-w-xl">
      <TutorialOverlay role="staff" />
      {children}
    </div>
  );
}
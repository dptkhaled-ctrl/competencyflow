"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function StaffLearnRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const lesson = searchParams.get("lesson");
    router.replace(lesson ? `/staff?lesson=${lesson}` : "/staff");
  }, [router, searchParams]);

  return null;
}

export default function StaffLearnRedirectPage() {
  return (
    <Suspense fallback={null}>
      <StaffLearnRedirect />
    </Suspense>
  );
}
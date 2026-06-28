import { Suspense } from "react";
import { StaffDashboard } from "@/components/staff/staff-dashboard";

export default function StaffHomePage() {
  return (
    <Suspense fallback={null}>
      <StaffDashboard />
    </Suspense>
  );
}
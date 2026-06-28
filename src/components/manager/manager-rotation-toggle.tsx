"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isRefresherRotationEnabled } from "@/lib/competency/domains";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentOrg } from "@/lib/store/hooks";

export function ManagerRotationToggle() {
  const org = useCurrentOrg();
  const updateOrganization = useAppStore((s) => s.updateOrganization);
  const enabled = isRefresherRotationEnabled(org);
  const [saving, setSaving] = useState(false);

  if (!org) return null;

  const toggle = async () => {
    setSaving(true);
    const next = !enabled;
    try {
      const res = await fetch("/api/manager/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          refresherRotationEnabled: next,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Could not save setting.");
        return;
      }
      updateOrganization(data.organization);
    } catch {
      alert("Network error — could not save setting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="border-slate-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <RotateCcw className="h-4 w-4" />
          Refresher rotation
          <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground ml-1">
            Optional
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground max-w-xl">
          {enabled
            ? "Staff get one timed refresher at a time, cycling through categories."
            : "Rotation is off. Staff only see assigned lessons — no auto-timed refreshers."}
        </p>
        <label className="flex items-center gap-2 shrink-0 cursor-pointer text-sm font-medium">
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={toggle}
            className="h-4 w-4 rounded border-gray-300"
          />
          {enabled ? "On" : "Off"}
        </label>
      </CardContent>
    </Card>
  );
}
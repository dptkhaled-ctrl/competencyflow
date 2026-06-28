"use client";

import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { User } from "@/lib/types";

export type RecipientMode = "everybody" | "specific";

interface StaffRecipientPickerProps {
  staff: User[];
  selectedIds: string[];
  onSelectedIdsChange: (ids: string[]) => void;
  mode: RecipientMode;
  onModeChange: (mode: RecipientMode) => void;
  className?: string;
}

export function getRecipientLabel(
  staff: User[],
  selectedIds: string[],
  mode: RecipientMode
): string {
  if (selectedIds.length === 0) return "no one selected";
  if (mode === "everybody" || selectedIds.length === staff.length) {
    return `all ${staff.length} staff`;
  }
  if (selectedIds.length === 1) {
    const person = staff.find((s) => s.id === selectedIds[0]);
    return person?.name ?? "1 staff member";
  }
  return `${selectedIds.length} staff`;
}

export function StaffRecipientPicker({
  staff,
  selectedIds,
  onSelectedIdsChange,
  mode,
  onModeChange,
  className,
}: StaffRecipientPickerProps) {
  const jobTitles = Array.from(
    new Set(staff.map((s) => s.jobTitle).filter(Boolean))
  ) as string[];

  const selectByTitle = (title: string) => {
    onModeChange("specific");
    onSelectedIdsChange(
      staff.filter((s) => s.jobTitle === title).map((s) => s.id)
    );
  };

  return (
    <div className={cn("rounded-lg border p-3 space-y-3 bg-muted/20", className)}>
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm font-medium">Who should get this?</Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={mode === "everybody" ? "default" : "outline"}
          onClick={() => {
            onModeChange("everybody");
            onSelectedIdsChange(staff.map((s) => s.id));
          }}
        >
          Everybody ({staff.length})
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === "specific" ? "default" : "outline"}
          onClick={() => {
            onModeChange("specific");
            if (mode === "everybody") {
              onSelectedIdsChange([]);
            }
          }}
        >
          Specific staff
        </Button>
      </div>

      {mode === "specific" && (
        <div className="space-y-2 border-t pt-3">
          {jobTitles.length > 0 && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">
                Quick pick by role
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {jobTitles.map((title) => (
                  <button
                    key={title}
                    type="button"
                    onClick={() => selectByTitle(title)}
                    className="rounded-full border bg-background px-2.5 py-1 text-xs hover:bg-muted transition-colors"
                  >
                    {title}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onSelectedIdsChange(staff.map((s) => s.id))}
            >
              Select all
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onSelectedIdsChange([])}
            >
              Clear
            </Button>
          </div>

          <div className="max-h-36 overflow-y-auto space-y-0.5 rounded-md border bg-background p-2">
            {staff.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">
                No staff on this team yet.
              </p>
            ) : (
              staff.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-2 text-sm py-1 cursor-pointer hover:bg-muted/50 px-1 rounded"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={() =>
                      onSelectedIdsChange(
                        selectedIds.includes(s.id)
                          ? selectedIds.filter((id) => id !== s.id)
                          : [...selectedIds, s.id]
                      )
                    }
                  />
                  <span>{s.name}</span>
                  {s.jobTitle ? (
                    <span className="text-xs text-muted-foreground">
                      ({s.jobTitle})
                    </span>
                  ) : null}
                </label>
              ))
            )}
          </div>

          {selectedIds.length === 0 && (
            <p className="text-xs text-amber-700">
              Pick at least one staff member to assign.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
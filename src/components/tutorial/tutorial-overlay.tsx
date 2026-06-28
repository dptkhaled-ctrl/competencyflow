"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type TutorialStep = {
  title: string;
  body: string;
};

const STAFF_STEPS: TutorialStep[] = [
  {
    title: "Welcome to CompetencyFlow",
    body: "Complete assigned lessons and quizzes here. Your progress is tracked for your manager and compliance records.",
  },
  {
    title: "Ask Policy",
    body: "Use the Ask button anytime to get answers from your organization's uploaded policies — with citations.",
  },
  {
    title: "Your dashboard",
    body: "Check due refreshers and structured lessons from the home tab. Tap a lesson to start.",
  },
];

const MANAGER_STEPS: TutorialStep[] = [
  {
    title: "Manager dashboard",
    body: "See team completion, at-risk staff, and competency gaps at a glance.",
  },
  {
    title: "Invite your team",
    body: "Go to Team → Invite staff. Each person receives an email to activate their account.",
  },
  {
    title: "Assign training",
    body: "Use Training and Categories to assign refreshers and review staff questions.",
  },
];

export function TutorialOverlay({ role }: { role: "staff" | "manager" }) {
  const storageKey = `cf_tutorial_${role}_v2`;
  const steps = role === "manager" ? MANAGER_STEPS : STAFF_STEPS;
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem(storageKey)) setOpen(true);
  }, [storageKey]);

  if (!open) return null;

  const current = steps[step];
  const isLast = step >= steps.length - 1;

  const finish = () => {
    localStorage.setItem(storageKey, "1");
    setOpen(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border bg-background p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-medium text-muted-foreground">
              Quick tour · {step + 1} of {steps.length}
            </p>
            <h3 className="mt-1 text-lg font-semibold">{current.title}</h3>
          </div>
          <button
            type="button"
            onClick={finish}
            className="rounded-lg p-1 text-muted-foreground hover:bg-muted"
            aria-label="Close tutorial"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{current.body}</p>
        <div className="mt-6 flex justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={finish}>
            Skip
          </Button>
          <Button
            size="sm"
            onClick={() => {
              if (isLast) finish();
              else setStep((s) => s + 1);
            }}
          >
            {isLast ? "Get started" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}
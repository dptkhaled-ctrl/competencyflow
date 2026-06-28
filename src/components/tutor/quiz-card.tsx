"use client";

import { CheckCircle2, CircleHelp, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TutorCard } from "@/lib/types";

interface QuizCardProps {
  card: TutorCard;
  onAnswer: (selectedIndex: number) => void;
  disabled?: boolean;
}

export function QuizCard({ card, onAnswer, disabled }: QuizCardProps) {
  const answered = card.answered;
  const correctIndex = card.correctIndex ?? 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <CircleHelp className="h-4 w-4 text-orange-500" />
        <span className="text-xs font-semibold text-slate-600">
          Quick check · {card.domainName}
        </span>
      </div>
      <div className="p-4">
        <p className="font-medium text-sm text-slate-900">{card.question}</p>
        <div className="mt-3 space-y-2">
          {(card.options ?? []).length === 0 && (
            <p className="text-xs text-red-500">Quiz options missing — ask for a new lesson.</p>
          )}
          {(card.options ?? []).map((opt, i) => {
            const isSelected = card.selectedIndex === i;
            const isCorrect = i === correctIndex;
            let style = "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40";

            if (answered) {
              if (isCorrect) style = "border-emerald-400 bg-emerald-50 text-emerald-900";
              else if (isSelected) style = "border-red-300 bg-red-50 text-red-900";
              else style = "border-slate-100 bg-slate-50 opacity-50";
            }

            return (
              <button
                key={i}
                type="button"
                disabled={disabled || answered}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAnswer(i);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all active:scale-[0.99]",
                  (disabled || answered) && "cursor-default",
                  style
                )}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="flex-1">{opt}</span>
                {answered && isCorrect && (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                )}
                {answered && isSelected && !isCorrect && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </button>
            );
          })}
        </div>
        {answered && card.explanation && (
          <p className="mt-3 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            {card.explanation}
          </p>
        )}
      </div>
    </div>
  );
}
"use client";

import { BookOpen, ChevronRight, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TutorCard } from "@/lib/types";

interface TeachCardProps {
  card: TutorCard;
  quizRevealed?: boolean;
  onReadyForQuiz?: () => void;
}

export function TeachCard({ card, quizRevealed, onReadyForQuiz }: TeachCardProps) {
  const slides = card.slides?.length
    ? card.slides
    : card.body
      ? [{ title: "Overview", body: card.body }]
      : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-white">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 opacity-90" />
          <span className="text-[11px] font-semibold uppercase tracking-wider opacity-90">
            {card.domainName ?? "Lesson"}
          </span>
        </div>
        <h4 className="mt-1 text-base font-semibold leading-snug">{card.title}</h4>
      </div>

      <div className="space-y-4 p-4">
        {card.hook && (
          <div className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <p className="leading-relaxed">{card.hook}</p>
          </div>
        )}

        {slides.map((slide, i) => (
          <div key={i} className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              {slide.title}
            </p>
            {slide.body.includes("•") || slide.body.includes("\n-") || slide.body.includes("\n*") ? (
              <ul className="text-sm leading-relaxed text-slate-700 space-y-0.5 list-disc pl-4">
                {slide.body
                  .split(/\n+/)
                  .map((l) => l.trim())
                  .filter(Boolean)
                  .map((l, li) => (
                    <li key={li}>{l.replace(/^[-•*]\s*/, "")}</li>
                  ))}
              </ul>
            ) : (
              <p className="text-sm leading-relaxed text-slate-700">{slide.body}</p>
            )}
          </div>
        ))}

        {card.citation && (
          <p className="border-t border-slate-100 pt-3 text-[11px] text-slate-400">
            Source: {card.citation.documentTitle} · {card.citation.section}
          </p>
        )}

        {!quizRevealed && onReadyForQuiz && (
          <Button
            type="button"
            className="mt-1 w-full bg-indigo-600 hover:bg-indigo-700"
            onClick={onReadyForQuiz}
          >
            I&apos;m ready — quick quiz
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
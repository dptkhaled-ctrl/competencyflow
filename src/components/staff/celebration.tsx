"use client";

import { CheckCircle2, Star } from "lucide-react";

export function Celebration({ score }: { score?: number }) {
  const isStrong = score === undefined || score >= 70;
  const title = "Great work!";
  const message = "You got the answers right. Well done!";

  return (
    <div className="relative overflow-hidden rounded-2xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-50 via-white to-emerald-50 p-6 text-center">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-10">
        {Array.from({ length: 6 }).map((_, i) => (
          <Star
            key={i}
            className="absolute h-4 w-4 text-emerald-500"
            style={{
              top: `${10 + (i % 2) * 30}%`,
              left: `${10 + (i % 4) * 22}%`,
              transform: `rotate(${i * 30}deg)`,
            }}
          />
        ))}
      </div>
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <h2 className="mt-2 text-lg font-semibold text-emerald-900">{title}</h2>
      <p className="mt-1 text-sm text-emerald-800">{message}</p>
    </div>
  );
}
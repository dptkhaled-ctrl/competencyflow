import { NextResponse } from "next/server";
import { readPlatform, writePlatform } from "@/lib/server/data-store";
import type { LessonProgress, Streak, UserXP } from "@/lib/types";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    progress?: LessonProgress;
    streak?: Streak;
    userXp?: UserXP;
  };

  const data = await readPlatform();

  if (body.progress) {
    const idx = data.progress.findIndex(
      (p) =>
        p.userId === body.progress!.userId &&
        p.lessonId === body.progress!.lessonId
    );
    if (idx >= 0) data.progress[idx] = body.progress;
    else data.progress.push(body.progress);
  }

  if (body.streak) {
    const idx = data.streaks.findIndex((s) => s.userId === body.streak!.userId);
    if (idx >= 0) data.streaks[idx] = body.streak;
    else data.streaks.push(body.streak);
  }

  if (body.userXp) {
    const idx = data.userXp.findIndex((x) => x.userId === body.userXp!.userId);
    if (idx >= 0) data.userXp[idx] = body.userXp;
    else data.userXp.push(body.userXp);
  }

  await writePlatform(data);
  return NextResponse.json({ ok: true });
}
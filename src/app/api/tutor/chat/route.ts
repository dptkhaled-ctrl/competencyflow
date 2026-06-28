import { NextResponse } from "next/server";
import { generateTutorResponse } from "@/lib/ai/tutor-orchestrator";
import {
  checkTutorRateLimit,
  getOrCreateSession,
  getTutorMessagesForUser,
  readPlatform,
  saveTutorMessages,
} from "@/lib/server/data-store";
import type { OrgType, TutorMessage } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const messages = await getTutorMessagesForUser(userId, 80);
  const platform = await readPlatform();
  const user = platform.users.find((u) => u.id === userId);
  const records = platform.competencyRecords.filter((r) => r.userId === userId);
  const domains = platform.competencyDomains.filter(
    (d) => d.orgId === user?.orgId
  );

  return NextResponse.json({ messages, records, domains });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, message, mode } = body as {
      userId?: string;
      message?: string;
      mode?: "session_start" | "continue" | "ask";
    };

    if (!userId) {
      return NextResponse.json({ error: "userId required" }, { status: 400 });
    }

    const allowed = await checkTutorRateLimit(userId);
    if (!allowed) {
      return NextResponse.json(
        { error: "You've reached the hourly message limit. Take a short break and try again." },
        { status: 429 }
      );
    }

    const platform = await readPlatform();
    const user = platform.users.find((u) => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const org = platform.organizations.find((o) => o.id === user.orgId);
    const { sessionId, isNew } = await getOrCreateSession(userId, user.orgId);
    const allMessages = await getTutorMessagesForUser(userId, 200);
    const recentMessages = allMessages.slice(-10);

    const usedLessonIds = new Set<string>([
      ...allMessages
        .flatMap((m) => m.cards ?? [])
        .map((c) => c.lessonId)
        .filter(Boolean) as string[],
      ...platform.assessmentEvents
        .filter((e) => e.userId === userId && e.lessonId)
        .map((e) => e.lessonId!),
    ]);

    const resolvedMode =
      mode ??
      (isNew && !message ? "session_start" : message?.includes("?") ? "ask" : "continue");

    const response = await generateTutorResponse({
      orgId: user.orgId,
      orgName: org?.name ?? "Organization",
      orgType: (org?.orgType ?? "snf") as OrgType,
      userId,
      userName: user.name,
      message: message?.trim() ?? "",
      mode: resolvedMode as "session_start" | "continue" | "ask" | "assess_followup",
      domains: platform.competencyDomains,
      records: platform.competencyRecords,
      assignments: platform.domainAssignments,
      lessons: platform.lessons,
      chunks: platform.documentChunks,
      recentMessages,
      usedLessonIds,
    });

    const now = new Date().toISOString();
    const toSave: TutorMessage[] = [];

    if (message?.trim()) {
      toSave.push({
        id: `tmsg-${Date.now()}-u`,
        sessionId,
        userId,
        role: "user",
        content: message.trim(),
        createdAt: now,
      });
    }

    toSave.push({
      id: `tmsg-${Date.now()}-a`,
      sessionId,
      userId,
      role: "assistant",
      content: response.message,
      cards: response.cards,
      createdAt: now,
    });

    await saveTutorMessages(toSave);

    const updated = await readPlatform();
    const records = updated.competencyRecords.filter((r) => r.userId === userId);
    const userXp = updated.userXp.find((x) => x.userId === userId);

    return NextResponse.json({
      sessionId,
      message: response.message,
      cards: response.cards,
      nextAction: response.nextAction,
      records,
      userXp,
      messages: await getTutorMessagesForUser(userId, 80),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Tutor error";
    if (msg.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    console.error("Tutor chat error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
import { NextResponse } from "next/server";
import { getUserAvgMastery } from "@/lib/competency/mastery";
import { getOrCreateSession, readPlatform, recordAssessment } from "@/lib/server/data-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      sessionId,
      cardId,
      question,
      selectedIndex,
      correctIndex,
      domainId,
      lessonId,
      sourceDocumentId,
    } = body as {
      userId?: string;
      sessionId?: string;
      cardId?: string;
      question?: string;
      selectedIndex?: number;
      correctIndex?: number;
      domainId?: string;
      lessonId?: string;
      sourceDocumentId?: string;
    };

    if (
      !userId ||
      !question ||
      selectedIndex === undefined ||
      correctIndex === undefined
    ) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const platform = await readPlatform();
    const user = platform.users.find((u) => u.id === userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    let resolvedDomainId = domainId;
    if (!resolvedDomainId) {
      resolvedDomainId = platform.competencyDomains.find(
        (d) => d.orgId === user.orgId
      )?.id;
    }
    if (!resolvedDomainId) {
      return NextResponse.json({ error: "No competency domain found" }, { status: 400 });
    }

    const { sessionId: activeSession } = sessionId
      ? { sessionId }
      : await getOrCreateSession(userId, user.orgId);

    const correct = selectedIndex === correctIndex;
    const before = platform.competencyRecords.find(
      (r) => r.userId === userId && r.domainId === resolvedDomainId
    );

    const { record, xpEarned, assessmentEvent } = await recordAssessment({
      userId,
      orgId: user.orgId,
      domainId: resolvedDomainId,
      sessionId: activeSession,
      question,
      selectedIndex,
      correctIndex,
      correct,
      sourceDocumentId,
      lessonId,
      createdAt: new Date().toISOString(),
    });

    const updated = await readPlatform();
    const domain = updated.competencyDomains.find((d) => d.id === resolvedDomainId);
    const avgMastery = getUserAvgMastery(
      updated.competencyRecords,
      updated.competencyDomains,
      userId,
      user.orgId
    );
    const userXp = updated.userXp.find((x) => x.userId === userId);

    return NextResponse.json({
      ok: true,
      cardId,
      correct,
      explanation: correct
        ? "Correct! Nice work."
        : "Not quite — review the concept and try the next one.",
      masteryBefore: before?.masteryPercent ?? 0,
      masteryAfter: record.masteryPercent,
      domainName: domain?.name ?? "Competency",
      xpEarned,
      avgMastery,
      record,
      userXp,
      assessmentEvent,
    });
  } catch (error) {
    console.error("Assess error:", error);
    return NextResponse.json({ error: "Assessment failed" }, { status: 500 });
  }
}
import { callOpenAI } from "@/lib/ai/client";
import { buildTutorUserPrompt, TUTOR_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  getUserAvgMastery,
  getWeakestDomain,
} from "@/lib/competency/mastery";
import { searchDocuments } from "@/lib/rag/search";
import type {
  CompetencyDomain,
  CompetencyRecord,
  DomainAssignment,
  Lesson,
  OrgType,
  TutorCard,
  TutorMessage,
} from "@/lib/types";

interface TutorAIResponse {
  message: string;
  cards: TutorCard[];
  nextAction?: string;
}

function cardId(): string {
  return `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function pickContentLibraryLesson(
  lessons: Lesson[],
  orgId: string,
  domainId?: string,
  usedLessonIds: Set<string> = new Set()
): Lesson | null {
  const pool = lessons
    .filter((l) => l.orgId === orgId && !usedLessonIds.has(l.id))
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));

  if (pool.length === 0) return null;

  if (domainId) {
    const domainMatch = pool.find((l) => l.competencyDomainId === domainId);
    if (domainMatch) return domainMatch;
  }

  return pool[0];
}

function buildTeachQuizFromLesson(lesson: Lesson, domain?: CompetencyDomain): TutorCard[] {
  const quiz = lesson.quiz[0];
  const domainName = domain?.name ?? lesson.category;
  const slides = lesson.slides.map((s) => ({
    title: s.title,
    body: s.body,
  }));

  return [
    {
      id: cardId(),
      type: "teach",
      title: lesson.title,
      hook: lesson.description,
      body: slides.map((s) => s.body).join("\n\n"),
      slides,
      domainId: lesson.competencyDomainId ?? domain?.id,
      domainName,
      lessonId: lesson.id,
      citation: {
        documentTitle: "Training library",
        section: slides[0]?.title ?? lesson.title,
      },
    },
    {
      id: cardId(),
      type: "quiz",
      question: quiz?.prompt ?? `What is the key point of ${lesson.title}?`,
      options: quiz?.options ?? ["A", "B", "C", "D"],
      correctIndex: quiz?.correctIndex ?? 0,
      domainId: lesson.competencyDomainId ?? domain?.id,
      domainName,
      lessonId: lesson.id,
      explanation: quiz?.explanation,
    },
  ];
}

function normalizeCards(
  cards: TutorCard[],
  domains: CompetencyDomain[],
  orgId: string
): TutorCard[] {
  const fallbackDomain = domains.find((d) => d.orgId === orgId);
  const normalized = cards.map((c) => ({
    ...c,
    id: c.id ?? cardId(),
    domainId: c.domainId ?? fallbackDomain?.id,
    domainName: c.domainName ?? fallbackDomain?.name ?? "General",
  }));

  const teach = normalized.filter((c) => c.type === "teach");
  const quiz = normalized.filter((c) => c.type === "quiz");
  const rest = normalized.filter((c) => c.type !== "teach" && c.type !== "quiz");

  if (quiz.length > 0 && teach.length === 0 && quiz[0].question) {
    teach.push({
      id: cardId(),
      type: "teach",
      title: quiz[0].domainName ?? "Key concept",
      body: "Review this concept from your training materials, then answer the quick check below.",
      domainId: quiz[0].domainId,
      domainName: quiz[0].domainName,
      lessonId: quiz[0].lessonId,
    });
  }

  return [...teach, ...quiz, ...rest];
}

function parseTutorJson(content: string): TutorAIResponse {
  const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Invalid tutor response");

  const parsed = JSON.parse(jsonMatch[0]) as {
    message?: string;
    cards?: TutorCard[];
    nextAction?: string;
  };

  const cards = (parsed.cards ?? []).map((c) => ({
    ...c,
    id: c.id ?? cardId(),
  }));

  return {
    message: parsed.message?.trim() || "Let's keep learning!",
    cards,
    nextAction: parsed.nextAction,
  };
}

function buildCompetencySummary(
  records: CompetencyRecord[],
  domains: CompetencyDomain[],
  userId: string,
  orgId: string
): string {
  const orgDomains = domains.filter((d) => d.orgId === orgId);
  if (orgDomains.length === 0) return "No competency domains yet.";

  return orgDomains
    .map((d) => {
      const r = records.find(
        (rec) => rec.userId === userId && rec.domainId === d.id
      );
      return `- ${d.name} (${d.id}): ${r?.masteryPercent ?? 0}% mastery, ${r?.assessmentCount ?? 0} assessments`;
    })
    .join("\n");
}

export async function generateTutorResponse(input: {
  orgId: string;
  orgName: string;
  orgType: OrgType;
  userId: string;
  userName: string;
  message: string;
  mode: "session_start" | "continue" | "ask" | "assess_followup";
  domains: CompetencyDomain[];
  records: CompetencyRecord[];
  assignments: DomainAssignment[];
  lessons: Lesson[];
  chunks: import("@/lib/types").DocumentChunk[];
  recentMessages: TutorMessage[];
  usedLessonIds?: Set<string>;
}): Promise<TutorAIResponse> {
  const weakest = getWeakestDomain(
    input.records,
    input.domains,
    input.userId,
    input.orgId
  );
  const assigned = input.assignments
    .filter((a) => a.userId === input.userId)
    .map((a) => input.domains.find((d) => d.id === a.domainId)?.name)
    .filter(Boolean);

  const targetDomainId =
    input.assignments.find((a) => a.userId === input.userId)?.domainId ??
    weakest?.id;

  const used = input.usedLessonIds ?? new Set<string>();
  const libraryLesson = pickContentLibraryLesson(
    input.lessons,
    input.orgId,
    targetDomainId,
    used
  );

  if (
    (input.mode === "session_start" || input.mode === "continue") &&
    libraryLesson &&
    !input.message.toLowerCase().includes("?")
  ) {
    const domain = input.domains.find(
      (d) => d.id === (libraryLesson.competencyDomainId ?? targetDomainId)
    );
    const avg = getUserAvgMastery(
      input.records,
      input.domains,
      input.userId,
      input.orgId
    );
    const firstName = input.userName.split(" ")[0];
    const greeting =
      input.mode === "session_start"
        ? `Hi ${firstName}!${assigned.length ? ` Your instructor assigned ${assigned.join(", ")}.` : ""} You're at ${avg}% training progress overall.`
        : `Nice work — here's your next topic:`;

    const cards = buildTeachQuizFromLesson(libraryLesson, domain);
    return {
      message: `${greeting}\n\nTake a minute to read through the lesson below. When you're ready, tap the button for a quick quiz.`,
      cards: normalizeCards(cards, input.domains, input.orgId),
      nextAction: "quiz",
    };
  }

  const query =
    input.message ||
    weakest?.name ||
    assigned[0] ||
    "core training topics";
  const ragResults = searchDocuments(input.orgId, query, 5, input.chunks);

  const contentLibrary = input.lessons
    .filter((l) => l.orgId === input.orgId)
    .slice(0, 6)
    .map(
      (l) =>
        `[${l.id}] ${l.title} (${l.category}): ${l.slides[0]?.body?.slice(0, 200) ?? l.description}`
    )
    .join("\n");

  const ragSources = ragResults
    .map(
      ({ chunk }) =>
        `${chunk.documentTitle} — ${chunk.section}\n${chunk.content.slice(0, 400)}`
    )
    .join("\n\n---\n\n");

  const recentMessages = input.recentMessages
    .slice(-10)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  if (ragResults.length === 0 && input.mode === "ask") {
    return {
      message:
        "I don't have uploaded material that covers that topic yet. Try asking about something in your training library, or check with your manager/instructor.",
      cards: weakest
        ? [
            {
              id: cardId(),
              type: "gap_review",
              title: `Review ${weakest.name}`,
              body: `Your weakest area is **${weakest.name}**. Want to review it?`,
              domainId: weakest.id,
              domainName: weakest.name,
            },
          ]
        : [],
      nextAction: "gap_review",
    };
  }

  const content = await callOpenAI({
    system: TUTOR_SYSTEM_PROMPT,
    user: buildTutorUserPrompt({
      orgName: input.orgName,
      orgType: input.orgType,
      userName: input.userName,
      message: input.message,
      mode: input.mode,
      competencySummary: buildCompetencySummary(
        input.records,
        input.domains,
        input.userId,
        input.orgId
      ),
      assignedDomains: assigned.join(", "),
      contentLibrary,
      ragSources,
      recentMessages,
    }),
    jsonMode: true,
    temperature: 0.35,
    maxTokens: 1500,
  });

  const parsed = parseTutorJson(content);
  parsed.cards = normalizeCards(parsed.cards, input.domains, input.orgId);

  for (const card of parsed.cards) {
    if (card.type === "quiz" && card.lessonId) {
      const lesson = input.lessons.find((l) => l.id === card.lessonId);
      const quiz = lesson?.quiz[0];
      if (quiz && !card.correctIndex && card.correctIndex !== 0) {
        card.correctIndex = quiz.correctIndex;
        card.options = quiz.options;
        card.question = quiz.prompt;
        card.explanation = quiz.explanation;
      }
    }
  }

  return parsed;
}
import { callOpenAI } from "@/lib/ai/client";
import { getCategoriesForOrgType } from "@/lib/competency/domains";
import { searchDocuments } from "@/lib/rag/search";
import type { DocumentChunk, OrgType } from "@/lib/types";

export interface RefresherRecommendation {
  type: "existing_lesson" | "custom_refresher";
  lessonId?: string;
  title: string;
  category: string;
  reason: string;
  confidence: "high" | "medium" | "low";
}

export interface RefresherRecommendResult {
  summary: string;
  primaryCategory: string;
  recommendations: RefresherRecommendation[];
  customRefresher?: {
    title: string;
    keyPoints: string;
  };
}

interface RecommendInput {
  incident: string;
  orgId: string;
  orgType: OrgType;
  orgName: string;
  lessons: Array<{
    id: string;
    title: string;
    category: string;
    isRefresher?: boolean;
  }>;
  documentChunks?: DocumentChunk[];
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(
    a
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );
  const tb = b
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  let score = 0;
  for (const w of tb) {
    if (ta.has(w)) score++;
  }
  return score;
}

function fallbackRecommend(input: RecommendInput): RefresherRecommendResult {
  const categories = getCategoriesForOrgType(input.orgType);
  const chunks = input.documentChunks ?? [];
  const rag = searchDocuments(input.orgId, input.incident, 2, chunks);

  let primaryCategory = categories[0];
  if (rag[0]?.chunk) {
    const section = rag[0].chunk.section.toLowerCase();
    const matched = categories.find(
      (c) =>
        section.includes(c.toLowerCase().slice(0, 12)) ||
        c.toLowerCase().includes(section.slice(0, 12))
    );
    if (matched) primaryCategory = matched;
  }

  const scoredLessons = input.lessons
    .map((lesson) => ({
      lesson,
      score:
        tokenOverlap(input.incident, lesson.title) * 3 +
        tokenOverlap(input.incident, lesson.category) * 2 +
        (lesson.category === primaryCategory ? 4 : 0) +
        (lesson.isRefresher ? 1 : 0),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const recommendations: RefresherRecommendation[] = scoredLessons
    .slice(0, 3)
    .map((s) => ({
      type: "existing_lesson" as const,
      lessonId: s.lesson.id,
      title: s.lesson.title,
      category: s.lesson.category,
      reason: `Matches "${s.lesson.category}" based on what you described.`,
      confidence: s.score >= 6 ? "high" : s.score >= 3 ? "medium" : "low",
    }));

  if (recommendations.length === 0 && input.lessons.length > 0) {
    const byCategory = input.lessons.filter((l) => l.category === primaryCategory);
    const pick = byCategory[0] ?? input.lessons[0];
    recommendations.push({
      type: "existing_lesson",
      lessonId: pick.id,
      title: pick.title,
      category: pick.category,
      reason: `Closest built lesson for ${primaryCategory}.`,
      confidence: "medium",
    });
  }

  const policyHint = rag[0]?.chunk
    ? `Policy note: ${rag[0].chunk.documentTitle} — ${rag[0].chunk.section}`
    : "";

  recommendations.push({
    type: "custom_refresher",
    title: `Refresher: ${input.incident.slice(0, 50).trim()}${input.incident.length > 50 ? "…" : ""}`,
    category: primaryCategory,
    reason:
      "Quick custom refresher tied to this incident" +
      (policyHint ? ` (${policyHint})` : "."),
    confidence: "medium",
  });

  return {
    summary: `Focus on ${primaryCategory} based on what happened.`,
    primaryCategory,
    recommendations,
    customRefresher: {
      title: `Refresher: ${input.incident.slice(0, 60).trim()}`,
      keyPoints: input.incident.trim(),
    },
  };
}

export async function recommendRefreshers(
  input: RecommendInput
): Promise<RefresherRecommendResult> {
  const categories = getCategoriesForOrgType(input.orgType);
  const lessonCatalog = input.lessons.map((l) => ({
    id: l.id,
    title: l.title,
    category: l.category,
    isRefresher: l.isRefresher ?? false,
  }));

  const rag = searchDocuments(
    input.orgId,
    input.incident,
    3,
    input.documentChunks ?? []
  );
  const policyContext = rag
    .map(
      (r, i) =>
        `[${i + 1}] ${r.chunk.documentTitle} — ${r.chunk.section}: ${r.chunk.content.slice(0, 200)}`
    )
    .join("\n");

  const prompt = `You help a manager at ${input.orgName} (${input.orgType}) assign the right training refresher after something happened on the floor.

INCIDENT (manager's description):
${input.incident}

ORG CATEGORIES (pick from these exact names):
${categories.map((c) => `- ${c}`).join("\n")}

BUILT LESSONS (prefer these when they fit — use exact lesson id):
${lessonCatalog.map((l) => `- id: ${l.id} | ${l.title} | ${l.category}`).join("\n") || "(none yet)"}

POLICY EXCERPTS (if any):
${policyContext || "(no direct policy match)"}

Return JSON only:
{
  "summary": "1-2 plain sentences for the manager",
  "primaryCategory": "exact category name from list",
  "recommendations": [
    {
      "type": "existing_lesson",
      "lessonId": "lesson-id-from-catalog",
      "title": "lesson title",
      "category": "category name",
      "reason": "short why this fits the incident",
      "confidence": "high|medium|low"
    }
  ],
  "customRefresher": {
    "title": "short refresher title if no built lesson fits well",
    "keyPoints": "2-3 bullet points to cover, grounded in incident + policy"
  }
}

Rules:
- Return 1-3 recommendations. Prefer existing_lesson when a built lesson clearly fits.
- Always include exactly one custom_refresher recommendation as a fallback option (type: "custom_refresher", no lessonId).
- Use only lesson ids from the catalog. Use only category names from the org list.
- Keep language simple — managers are busy.`;

  try {
    const raw = await callOpenAI({
      system:
        "You recommend training refreshers for healthcare managers. Return valid JSON only.",
      user: prompt,
      jsonMode: true,
      temperature: 0.25,
      maxTokens: 900,
    });

    const parsed = JSON.parse(raw);
    const primaryCategory =
      categories.find((c) => c === parsed.primaryCategory) ??
      categories.find((c) =>
        String(parsed.primaryCategory || "")
          .toLowerCase()
          .includes(c.toLowerCase().slice(0, 10))
      ) ??
      categories[0];

    const recommendations: RefresherRecommendation[] = [];
    const rawRecs = Array.isArray(parsed.recommendations)
      ? parsed.recommendations
      : [];

    for (const r of rawRecs.slice(0, 4)) {
      const type =
        r.type === "custom_refresher" ? "custom_refresher" : "existing_lesson";
      if (type === "existing_lesson") {
        const lesson = lessonCatalog.find((l) => l.id === r.lessonId);
        if (!lesson) continue;
        recommendations.push({
          type: "existing_lesson",
          lessonId: lesson.id,
          title: lesson.title,
          category: lesson.category,
          reason: String(r.reason || "Matches this incident."),
          confidence:
            r.confidence === "high" || r.confidence === "low"
              ? r.confidence
              : "medium",
        });
      } else {
        recommendations.push({
          type: "custom_refresher",
          title: String(r.title || parsed.customRefresher?.title || "Custom refresher"),
          category:
            categories.find((c) => c === r.category) ?? primaryCategory,
          reason: String(r.reason || "Tailored to this incident."),
          confidence: "medium",
        });
      }
    }

    if (!recommendations.some((r) => r.type === "custom_refresher")) {
      recommendations.push({
        type: "custom_refresher",
        title: String(
          parsed.customRefresher?.title ??
            `Refresher: ${input.incident.slice(0, 50)}`
        ),
        category: primaryCategory,
        reason: "Quick custom refresher based on what happened.",
        confidence: "medium",
      });
    }

    if (recommendations.filter((r) => r.type === "existing_lesson").length === 0) {
      const fallback = fallbackRecommend(input);
      const existing = fallback.recommendations.filter(
        (r) => r.type === "existing_lesson"
      );
      recommendations.unshift(...existing.slice(0, 2));
    }

    return {
      summary: String(parsed.summary || `Recommendations for ${primaryCategory}.`),
      primaryCategory,
      recommendations: recommendations.slice(0, 4),
      customRefresher: parsed.customRefresher
        ? {
            title: String(parsed.customRefresher.title || ""),
            keyPoints: String(parsed.customRefresher.keyPoints || input.incident),
          }
        : undefined,
    };
  } catch {
    return fallbackRecommend(input);
  }
}
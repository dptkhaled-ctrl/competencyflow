import { documentChunks } from "@/lib/data/documents";
import { searchDocuments } from "@/lib/rag/search";
import type { DocumentChunk, Incident, Lesson, QuizQuestion } from "@/lib/types";

function buildQuizFromContent(content: string, section: string): QuizQuestion[] {
  const sentences = content.split(/(?<=[.!?])\s+/).filter((s) => s.length > 20);
  const fact = sentences[0] ?? content;

  return [
    {
      id: "gen-q1",
      prompt: `According to the ${section} policy, which statement is correct?`,
      options: [
        fact.slice(0, 80) + (fact.length > 80 ? "…" : ""),
        "Ignore the procedure and proceed if busy",
        "Only managers need to follow this rule",
        "Reporting is optional for near-misses",
      ],
      correctIndex: 0,
      explanation: `This refresher reinforces: ${fact}`,
    },
  ];
}

/**
 * Auto-generate a targeted micro-lesson from an incident description
 * by matching relevant policy chunks.
 */
export function generateRefresherLesson(
  incident: Incident,
  chunks: DocumentChunk[] = documentChunks
): Lesson {
  const searchText = `${incident.title} ${incident.description} ${incident.category}`;
  const results = searchDocuments(incident.orgId, searchText, 2, chunks);

  const primary = results[0]?.chunk;
  const secondary = results[1]?.chunk;

  const slides = primary
    ? [
        {
          id: "gen-s1",
          title: "What happened & why it matters",
          body: `This refresher was created after: "${incident.title}". ${primary.content}`,
          durationSeconds: 50,
        },
        {
          id: "gen-s2",
          title: "Correct procedure",
          body: secondary
            ? `${secondary.documentTitle} — ${secondary.section}: ${secondary.content}`
            : primary.content,
          durationSeconds: 45,
        },
      ]
    : [
        {
          id: "gen-s1",
          title: "Incident review",
          body: `Review the events around "${incident.title}" and follow your team's safety checklist before resuming work.`,
          durationSeconds: 45,
        },
      ];

  const quizSource = primary?.content ?? incident.description;

  return {
    id: `lesson-generated-${incident.id}`,
    orgId: incident.orgId,
    title: `Refresher: ${incident.category} — ${incident.title.slice(0, 40)}`,
    description: `Targeted refresher generated from incident logged on ${incident.occurredAt}.`,
    category: incident.category,
    estimatedMinutes: 2,
    slides,
    quiz: buildQuizFromContent(
      quizSource,
      primary?.section ?? incident.category
    ),
    sourceDocumentIds: primary
      ? [primary.documentId, ...(secondary ? [secondary.documentId] : [])]
      : [],
    isRefresher: true,
    generatedFromIncidentId: incident.id,
  };
}

export function getRelevantPolicySummary(
  incident: Incident,
  chunks: DocumentChunk[] = documentChunks
): string {
  const results = searchDocuments(
    incident.orgId,
    `${incident.title} ${incident.description}`,
    1,
    chunks
  );
  const chunk = results[0]?.chunk;
  if (!chunk) return "No direct policy match — a general safety refresher will be assigned.";

  const related = documentChunks.filter(
    (c) => c.orgId === incident.orgId && c.documentId === chunk.documentId
  ).length;

  return `Matched **${chunk.documentTitle}** → ${chunk.section} (${related} related sections in library)`;
}
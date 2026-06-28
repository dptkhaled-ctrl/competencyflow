import type { SearchResult } from "@/lib/rag/search";

export interface ChatResponse {
  answer: string;
  citations: Array<{
    documentTitle: string;
    section: string;
    excerpt: string;
  }>;
}

export function generateGroundedResponse(results: SearchResult[]): ChatResponse {
  if (results.length === 0) {
    return {
      answer:
        "I don't have a direct match in the materials for that. Can you rephrase or give more context? I'll do my best to find the closest information available.",
      citations: [],
    };
  }

  const citations = results.map(({ chunk }) => ({
    documentTitle: chunk.documentTitle,
    section: chunk.section,
    excerpt:
      chunk.content.length > 180
        ? `${chunk.content.slice(0, 180).trim()}…`
        : chunk.content,
  }));

  const primary = results[0].chunk;
  const supporting = results.slice(1);

  let answer = `Based on **${primary.documentTitle}** (${primary.section}):\n\n${primary.content}`;

  if (supporting.length > 0) {
    answer += "\n\n**Related guidance:**\n";
    for (const { chunk } of supporting) {
      answer += `• ${chunk.documentTitle} — ${chunk.section}: ${chunk.content.slice(0, 120)}…\n`;
    }
  }

  answer +=
    "\n\n_This answer is grounded in your organization's uploaded policies. For edge cases, confirm with your supervisor._";

  return { answer, citations };
}
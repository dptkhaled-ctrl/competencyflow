import { callOpenAI } from "@/lib/ai/client";
import { buildChatUserPrompt, CHAT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { searchDocuments } from "@/lib/rag/search";
import type { DocumentChunk } from "@/lib/types";

export interface ChatResponse {
  answer: string;
  citations: Array<{
    documentTitle: string;
    section: string;
    excerpt: string;
  }>;
}

function parseChatJson(content: string): ChatResponse {
  const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI did not return valid JSON");

  const parsed = JSON.parse(jsonMatch[0]) as {
    answer?: string;
    citations?: ChatResponse["citations"];
  };

  return {
    answer:
      parsed.answer?.trim() ||
      "I couldn't generate an answer. Please try rephrasing your question.",
    citations: (parsed.citations ?? []).slice(0, 5).map((c) => ({
      documentTitle: c.documentTitle ?? "Document",
      section: c.section ?? "Section",
      excerpt: (c.excerpt ?? "").slice(0, 180),
    })),
  };
}

function fallbackResponse(
  sources: Array<{ documentTitle: string; section: string; content: string }>
): ChatResponse {
  if (sources.length === 0) {
    return {
      answer:
        "I don't have a direct match in the uploaded materials for that exact question. Can you rephrase it or give me a bit more detail about the situation? I'm here to help pull up whatever's available.",
      citations: [],
    };
  }

  const primary = sources[0];
  return {
    answer: `From the materials I found, here's the most relevant info:\n\n**${primary.documentTitle}** (${primary.section}):\n\n${primary.content}\n\nIf this isn't quite what you meant, try asking in a different way — happy to dig further!`,
    citations: sources.slice(0, 3).map((s) => ({
      documentTitle: s.documentTitle,
      section: s.section,
      excerpt:
        s.content.length > 180 ? `${s.content.slice(0, 180).trim()}…` : s.content,
    })),
  };
}

export async function generateAIChatResponse(input: {
  orgId: string;
  orgName: string;
  question: string;
  chunks: DocumentChunk[];
}): Promise<ChatResponse> {
  const results = searchDocuments(input.orgId, input.question.trim(), 5, input.chunks);
  const sources = results.map(({ chunk }) => ({
    documentTitle: chunk.documentTitle,
    section: chunk.section,
    content: chunk.content,
  }));

  if (sources.length === 0) {
    return fallbackResponse([]);
  }

  try {
    const content = await callOpenAI({
      system: CHAT_SYSTEM_PROMPT,
      user: buildChatUserPrompt({
        orgName: input.orgName,
        question: input.question,
        sources,
      }),
      jsonMode: true,
      temperature: 0.2,
    });
    return parseChatJson(content);
  } catch {
    return fallbackResponse(sources);
  }
}
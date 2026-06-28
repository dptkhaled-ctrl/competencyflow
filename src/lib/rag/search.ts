import { documentChunks as seedChunks } from "@/lib/data/documents";
import type { DocumentChunk } from "@/lib/types";

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "what", "when", "where", "how",
  "do", "does", "did", "can", "could", "should", "would", "i", "we", "you", "my",
  "our", "to", "of", "in", "on", "for", "and", "or", "it", "that", "this", "be",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s/-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function scoreChunk(chunk: DocumentChunk, queryTokens: string[]): number {
  const chunkTokens = new Set([
    ...tokenize(chunk.content),
    ...chunk.keywords.flatMap((k) => tokenize(k)),
    ...tokenize(chunk.section),
    ...tokenize(chunk.documentTitle),
  ]);

  let score = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) score += 2;
    for (const kw of chunk.keywords) {
      if (kw.toLowerCase().includes(token)) score += 3;
    }
    if (chunk.content.toLowerCase().includes(token)) score += 1;
  }
  return score;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export function searchDocuments(
  orgId: string,
  query: string,
  limit = 3,
  chunks: DocumentChunk[] = seedChunks
): SearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  return chunks
    .filter((c) => c.orgId === orgId)
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
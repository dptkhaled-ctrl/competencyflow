import { callOpenAI } from "@/lib/ai/client";
import { COMPETENCY_EXTRACT_PROMPT } from "@/lib/ai/prompts";
import { prepareDocumentForAI } from "@/lib/ai/document-prep";
import { getCategoriesForOrgType } from "@/lib/competency/domains";
import type { OrgType } from "@/lib/types";

export async function extractCompetencyDomains(input: {
  orgType: OrgType;
  documentTitle: string;
  rawText: string;
}): Promise<Array<{ name: string; description?: string }>> {
  const prepared = prepareDocumentForAI(input.rawText).slice(0, 8000);
  const userPrompt = `ORG TYPE: ${input.orgType}
DOCUMENT: ${input.documentTitle}

SOURCE:
---
${prepared}
---`;

  try {
    const content = await callOpenAI({
      system: COMPETENCY_EXTRACT_PROMPT,
      user: userPrompt,
      jsonMode: true,
      temperature: 0.2,
    });
    const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as {
      domains?: Array<{ name: string; description?: string }>;
    };
    return (parsed.domains ?? []).filter((d) => d.name?.trim());
  } catch {
    return [];
  }
}

/**
 * AI suggests the most relevant category(ies) for a document from the *exact* predefined list
 * for the given orgType. Supports multi-category assignment when the doc covers multiple topics.
 * Admin will review/confirm before any lesson processing.
 */
export async function suggestRelevantCategories(input: {
  orgType: OrgType;
  documentTitle: string;
  rawText: string;
}): Promise<string[]> {
  const available = getCategoriesForOrgType(input.orgType);
  if (available.length === 0) return [];

  const prepared = prepareDocumentForAI(input.rawText).slice(0, 7000);

  const listBlock = available.map((c) => `- ${c}`).join("\n");

  const userPrompt = `ORG TYPE: ${input.orgType}
DOCUMENT: ${input.documentTitle}

AVAILABLE CATEGORIES (MUST choose ONLY from these exact strings, can pick more than one if the document content is relevant to multiple):
${listBlock}

SOURCE EXCERPT (analyze for relevance):
---
${prepared}
---

Task: Return a JSON object with the most relevant categories from the list above that this document should be assigned to.
Prefer 1-3 best matches. A document can legitimately belong to multiple categories.
Output ONLY:
{
  "categories": ["Exact Category Name One", "Exact Category Name Two"]
}
Do not invent names outside the list. If the content is broad, pick the strongest matches.`;

  try {
    const content = await callOpenAI({
      system:
        "You are an expert at mapping healthcare training documents to standardized competency categories for SNF, Behavioral Health, or Home Health facilities. Only use exact category names from the provided list. Output strictly valid JSON.",
      user: userPrompt,
      jsonMode: true,
      temperature: 0.1,
    });
    const jsonMatch = content.trim().match(/\{[\s\S]*\}/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]) as { categories?: string[] };
    const picked = (parsed.categories ?? [])
      .map((c) => c.trim())
      .filter((c) => available.includes(c));
    // Dedupe while preserving order
    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const c of picked) {
      if (!seen.has(c)) {
        seen.add(c);
        deduped.push(c);
      }
    }
    return deduped.length > 0 ? deduped : [available[0]]; // at least one sensible default
  } catch {
    // Fallback: no AI, return first as minimal suggestion (admin will edit)
    return [available[0]];
  }
}
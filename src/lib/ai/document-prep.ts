/**
 * Prepares large documents for AI analysis without sending the entire file.
 * Samples beginning, structure hints, and representative sections.
 */
export function prepareDocumentForAI(rawText: string, maxChars = 14000): string {
  const cleaned = rawText
    .replace(/\f/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= maxChars) return cleaned;

  const head = cleaned.slice(0, 4500);
  const tail = cleaned.slice(-2500);

  const quarter = Math.floor(cleaned.length / 4);
  const mid1 = cleaned.slice(quarter, quarter + 2000);
  const mid2 = cleaned.slice(quarter * 2, quarter * 2 + 2000);
  const mid3 = cleaned.slice(quarter * 3, quarter * 3 + 2000);

  const headers = extractSectionHints(cleaned);

  return `[EXCERPT FROM ${cleaned.length.toLocaleString()} CHARACTER DOCUMENT]

KEY SECTIONS DETECTED:
${headers.join("\n")}

——— OPENING ———
${head}

——— SECTION SAMPLE 1 ———
${mid1}

——— SECTION SAMPLE 2 ———
${mid2}

——— SECTION SAMPLE 3 ———
${mid3}

——— CLOSING ———
${tail}`;
}

function extractSectionHints(text: string): string[] {
  const hints: string[] = [];
  const patterns = [
    /(?:^|\n)\s*(?:Chapter|Section|Part|Module|Unit)\s+[\dIVX]+[.:]\s*[^\n]{5,80}/gi,
    /(?:^|\n)\s*\d+\.\s+[A-Z][^\n]{10,80}/g,
    /(?:^|\n)\s*[A-Z][A-Z\s]{4,40}(?:\n|$)/g,
  ];

  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches.slice(0, 15)) {
        const line = m.trim().replace(/\s+/g, " ");
        if (line.length > 8 && line.length < 100) hints.push(`• ${line}`);
      }
    }
  }

  return [...new Set(hints)].slice(0, 12).length > 0
    ? [...new Set(hints)].slice(0, 12)
    : ["• (No clear section headers — analyze content themes)"];
}
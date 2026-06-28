import { callOpenAI } from "@/lib/ai/client";

export interface PainPoint {
  title: string;
  count: number;
  examples: string[];
  recommendation: string;
}

export async function analyzePainPoints(
  questions: string[],
  orgName: string
): Promise<PainPoint[]> {
  if (!questions.length) {
    return [];
  }

  const prompt = `You are an expert training and operations analyst for ${orgName}.

You are given real questions that frontline staff have asked the organization's internal AI Policy Assistant (RAG chatbot grounded only in company materials).

Group these questions into 3–5 clear "pain points" or recurring areas of confusion.

For each pain point return:
- title: short 3-7 word label (e.g. "Hand hygiene timing and glove rules")
- count: approximate number of related questions (integer)
- examples: 1-2 verbatim example staff questions (keep original wording)
- recommendation: one crisp, actionable recommendation for the manager (e.g. "Assign the Hand Hygiene Protocol lesson as a 7-day refresher to the whole team" or "Clarify workstation log-off policy in next huddle and add a 60-second micro-lesson")

Return ONLY valid JSON in this exact shape (no extra text):
{
  "painPoints": [
    {
      "title": "string",
      "count": 3,
      "examples": ["string", "string"],
      "recommendation": "string"
    }
  ]
}

Staff questions (one per line):
${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;

  try {
    const raw = await callOpenAI({
      system: "You produce structured, actionable JSON analysis only. Never add commentary outside the JSON.",
      user: prompt,
      jsonMode: true,
      temperature: 0.3,
    });

    const parsed = JSON.parse(raw);
    const points = Array.isArray(parsed?.painPoints) ? parsed.painPoints : [];
    return points
      .filter((p: any) => p.title && p.recommendation)
      .slice(0, 5)
      .map((p: any) => ({
        title: String(p.title),
        count: Number(p.count) || 1,
        examples: Array.isArray(p.examples) ? p.examples.slice(0, 2).map(String) : [],
        recommendation: String(p.recommendation),
      }));
  } catch (e) {
    // Graceful fallback using simple grouping for demo reliability
    return fallbackPainPoints(questions);
  }
}

function fallbackPainPoints(questions: string[]): PainPoint[] {
  // Very lightweight keyword clustering so it still works without OpenAI or on error
  const groups: Record<string, string[]> = {};
  for (const q of questions) {
    const lower = q.toLowerCase();
    let key = "General policy questions";
    if (lower.includes("hand") || lower.includes("hygiene") || lower.includes("glove")) key = "Hand hygiene & glove rules";
    else if (lower.includes("log off") || lower.includes("workstation") || lower.includes("logoff")) key = "Workstation security & log-off";
    else if (lower.includes("confidential") || lower.includes("share") || lower.includes("privacy")) key = "Information privacy and confidentiality";
    else if (lower.includes("rotator") || lower.includes("cuff") || lower.includes("shoulder")) key = "Rotator cuff & shoulder assessment";
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  }
  return Object.entries(groups)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 4)
    .map(([title, exs]) => ({
      title,
      count: exs.length,
      examples: exs.slice(0, 2),
      recommendation: `Review this topic with the team and consider a short targeted refresher lesson.`,
    }));
}

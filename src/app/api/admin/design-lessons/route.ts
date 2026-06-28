import { NextResponse } from "next/server";
import { callOpenAI } from "@/lib/ai/client";
import { readPlatform } from "@/lib/server/data-store";
import { prepareDocumentForAI } from "@/lib/ai/document-prep";
import { getCategoriesForOrgType } from "@/lib/competency/domains";
import type { OrgType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const { orgId, instructions, selectedMaterialIds } = await request.json();

    if (!orgId || !instructions?.trim()) {
      return NextResponse.json({ error: "orgId and instructions are required" }, { status: 400 });
    }

    const platform = await readPlatform();
    const org = platform.organizations?.find((o: any) => o.id === orgId);
    const orgType = (org?.orgType as OrgType) || "snf";
    let orgMaterials = platform.uploadedMaterials?.filter((m: any) => m.orgId === orgId) || [];
    let orgChunks = platform.documentChunks?.filter((c: any) => c.orgId === orgId) || [];

    // Filter to selected materials if provided
    if (Array.isArray(selectedMaterialIds) && selectedMaterialIds.length > 0) {
      const sel = new Set(selectedMaterialIds);
      orgMaterials = orgMaterials.filter((m: any) => sel.has(m.id));
      if (orgChunks.length > 0) {
        orgChunks = orgChunks.filter((c: any) => sel.has(c.documentId));
      }
    }

    // Categories from the actually selected/checked files
    const selectedFileCategories = new Set<string>();
    orgMaterials.forEach((m: any) => {
      (m.assignedCategories || []).forEach((c: string) => selectedFileCategories.add(c));
    });

    if (orgMaterials.length === 0 && orgChunks.length === 0) {
      return NextResponse.json({ error: "No materials selected or available for this organization." }, { status: 400 });
    }

    // Prepare context from existing (filtered) materials/chunks
    let preparedText = "";
    if (orgChunks.length > 0) {
      preparedText = orgChunks.map((c: any) => c.content).join("\n\n---\n\n").slice(0, 8000);
    } else {
      // Fallback: use any extracted text if present, or simulate
      preparedText = orgMaterials.map((m: any) => m.fileName).join(", ");
    }

    // Compute required categories + current coverage so the AI knows what "enough to cover all required items" means
    // and can prioritize high-priority topics that have good support in the uploaded files.
    const requiredCategories = getCategoriesForOrgType(orgType);
    const existingLessonCategories = new Set(
      (platform.lessons || [])
        .filter((l: any) => l.orgId === orgId)
        .map((l: any) => l.category)
    );
    const taggedDocCategories = new Set<string>();
    orgMaterials.forEach((m: any) => {
      (m.assignedCategories || []).forEach((c: string) => taggedDocCategories.add(c));
    });

    const requiredList = requiredCategories.join(" | ");
    const hasLessons = requiredCategories.filter((c) => existingLessonCategories.has(c));
    const missingLessons = requiredCategories.filter((c) => !existingLessonCategories.has(c));
    const highPriorityFromFiles = requiredCategories.filter((c) => taggedDocCategories.has(c));

    const coverageContext = `
FACILITY REQUIRED CATEGORIES (${orgType.toUpperCase()}): ${requiredList}

CURRENT LESSON COVERAGE: ${hasLessons.length ? hasLessons.join(", ") : "none yet"}
CATEGORIES STILL MISSING LESSONS: ${missingLessons.length ? missingLessons.join(", ") : "all covered"}

HIGH-PRIORITY / SELECTED CATEGORIES FROM THE CHECKED FILES (use these or the closest matching for the lessons you generate):
${Array.from(selectedFileCategories).join(" | ") || (highPriorityFromFiles.length ? highPriorityFromFiles.join(" | ") : "analyze the excerpts for which required topics have substantial detailed content (policies, procedures, safety-critical items)")}

GOAL FOR THIS GENERATION: 
Follow the user's custom instructions exactly for the number of lessons to produce.
- If the user explicitly requests a specific number (e.g. "create 5 lessons", "make exactly 3", "produce 6 lessons"), generate that many (or very close to it) high-quality lessons.
- Only fall back to a small number (2-4) if the user did not specify a count.
- Do not arbitrarily cap at 2-4 or "small set" when the user asked for more.
- CRITICAL: The "category" for every generated lesson MUST be taken from the SELECTED/CHECKED CATEGORIES list above (use the exact name). Choose the most relevant one based on the actual content of the selected files. Do not pick unrelated categories.
- Do not fabricate content for categories with little or no support in the excerpts.
- Emphasize practical, high-impact items for frontline staff.

EXPERT HEALTHCARE TRAINER RULES (apply to every lesson):
1. Focus on ACTIONS not policy language. What should the staff member DO?
2. Only high-risk / high-frequency content. 60-120 seconds max.
3. Extremely practical: short bullets or action steps in slides. Brief "Why it matters".
4. Quiz = scenario Quick Check. Correct answer supported in the slides of that lesson.
5. Action-oriented titles. estimatedMinutes 1 or 2.
6. Ground strictly in source excerpts provided. Role-appropriate for CNAs and aides.
`;

    const customPrompt = `User custom instructions for lesson design (follow these strictly and prioritize them above general rules):
${instructions}

${coverageContext}

CRITICAL COUNT INSTRUCTION: 
The user may have requested a specific number of lessons (e.g. "create 5 lessons", "make exactly 4", "produce 6"). When they do:
- You MUST output an array with close to or exactly that number of lesson objects.
- Do NOT default to 2-4 or reduce the count.
- Count the items you put in the "lessons" array before responding.
Quality per lesson still matters, but honor the requested count exactly as stated in the instructions.

Generate the exact number of extremely practical micro-lessons requested in the user's custom instructions above (use 2-4 only if the user did not specify a number). Each lesson should be 60-120 seconds (estimatedMinutes 1 or 2) based on the provided material and rules.

CRITICAL CATEGORY RULE (HIGHEST PRIORITY):
The source files you were given are tagged with specific categories (see "HIGH-PRIORITY / SELECTED CATEGORIES FROM THE CHECKED FILES" and the file list).
- You MUST set the "category" of EVERY lesson to an EXACT name from the SELECTED CATEGORIES of the checked files.
- Choose the best matching one based on what the actual content is about.
- Do NOT use any category that is not present in the selected source files.
- If the content relates to multiple, pick the most appropriate from the selected ones.

Follow the EXPERT HEALTHCARE TRAINER RULES for every lesson: action-focused, high-risk only, bullets/steps in slides, brief why matters, scenario Quick Checks.
User's custom instructions take priority where they conflict with defaults — especially any specific count of lessons they requested.

STRICT JSON OUTPUT RULES (VERY IMPORTANT - FOLLOW EXACTLY TO AVOID PARSE ERRORS):
- Your entire response must be ONLY one valid JSON object. No text before the opening { and no text after the closing }.
- No markdown code blocks, no explanations, no "Here is the JSON", nothing else.
- The value of "lessons" must be a proper JSON array.
- Put a comma between every lesson object in the array and between every property inside each lesson.
- NO trailing commas after the last element in any array or object.
- Every string value must be valid JSON (escape quotes etc). Keep slide bodies short and clean. Use \n for bullets inside body strings if needed.
- Slides: 2-3 per lesson. Bodies can use bullet formatting for key actions.

Return ONLY the following valid JSON structure (and nothing else). The "lessons" array must contain the exact number of lessons requested by the user (or 2-4 if unspecified):
{
  "lessons": [
    {
      "title": "action-oriented title",
      "description": "short hook or why it matters",
      "category": "Must be one of the SELECTED/CHECKED CATEGORIES from the source files (listed above). Use the exact name that best matches the content.",
      "estimatedMinutes": 1,
      "slides": [{"title": "action step title", "body": "concise actions or • bullets"}],
      "quiz": {
        "prompt": "scenario-based Quick Check question",
        "options": ["A", "B", "C", "D"],
        "correctIndex": 0,
        "explanation": "brief"
      }
    }
    // ... more lesson objects if the user asked for more than 1
  ]
}`;

    const selectedFilesNote = Array.isArray(selectedMaterialIds) && selectedMaterialIds.length > 0
      ? `\n\nSELECTED/CHECKED FILES FOR THIS RUN (${orgMaterials.length}):\n${orgMaterials.map((m: any) => `- ${m.fileName} (categories: ${(m.assignedCategories || []).join(', ')})`).join("\n")}`
      : "";

    const fullUserPrompt = `ORGANIZATION: ${platform.organizations?.find((o: any) => o.id === orgId)?.name || "Client"}
MATERIAL CONTEXT (from uploaded files):
${preparedText}${selectedFilesNote}

${customPrompt}`;

    const raw = await callOpenAI({
      system: "You are an expert healthcare trainer for frontline SNF, behavioral health, and home health staff. Create highly practical, actionable 60-120s micro-lessons ONLY from provided excerpts. Strictly follow EXPERT TRAINER RULES + COVERAGE GOAL + user's instructions in the prompt. CRITICAL: The category for every lesson MUST be taken verbatim from the SELECTED/CHECKED CATEGORIES of the files provided in the prompt (exact name match). Never invent or use categories outside the selected source files' categories. Action titles, bullet actions in slides, scenario quizzes. If the user requests a specific number of lessons (e.g. 'create 5'), output exactly that many in the lessons array — count them yourself before finishing. Do not default to small numbers unless requested. Response must be 100% valid JSON and NOTHING ELSE — start with { end with }. No markdown, no extra text.",
      user: fullUserPrompt,
      jsonMode: true,
      temperature: 0.25,
      maxTokens: 4000,
    });

    // Robust cleaning for LLM JSON responses (they frequently produce slightly invalid JSON especially with long arrays)
    let cleaned = raw.trim();

    // Aggressively strip any text before the first { and after the last }
    const firstBrace = cleaned.indexOf('{');
    if (firstBrace > 0) cleaned = cleaned.substring(firstBrace);
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > 0 && lastBrace < cleaned.length - 1) cleaned = cleaned.substring(0, lastBrace + 1);

    cleaned = cleaned
      .replace(/```json/gi, '')
      .replace(/```/g, '')
      .replace(/^(Here\s+is\s+the\s+JSON|The\s+following\s+is\s+the\s+JSON|json\s*:\s*)/i, '')
      .trim();

    // Try to extract the outermost JSON object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch (parseErr) {
      // Multi-stage salvage for common LLM mistakes (especially missing commas between large array elements in "lessons")
      let salvaged = (jsonMatch ? jsonMatch[0] : cleaned)
        .replace(/,\s*([}\]])/g, '$1')           // trailing commas before } or ]
        .replace(/([{\[])\s*,/g, '$1')           // leading commas after { or [
        .replace(/[\x00-\x1F]+/g, ' ')           // strip control characters that break strings
        .replace(/\n/g, '\\n')                   // escape literal newlines that sometimes appear unescaped in strings
        .replace(/\r/g, '\\r');

      // Specific repair for the most common failure when generating many lessons:
      // LLM outputs } { instead of }, { between array elements (missing comma after an object)
      salvaged = salvaged.replace(/}\s*{/g, '},{');
      salvaged = salvaged.replace(/}\s*\[/g, '},[');

      // Also try to fix missing comma after a string value in arrays/objects in some cases
      salvaged = salvaged.replace(/"\s*{/g, '",{');
      salvaged = salvaged.replace(/"\s*\[/g, '",[');

      try {
        parsed = JSON.parse(salvaged);
      } catch (salvageErr2) {
        // Final aggressive attempt: truncate to the last complete top-level object
        const finalAttempt = salvaged.replace(/}[^}]*$/, '}');
        try {
          parsed = JSON.parse(finalAttempt);
        } catch (finalErr) {
          // Give up - will be caught by outer handler
          throw parseErr;
        }
      }
    }

    if (!parsed.lessons || !Array.isArray(parsed.lessons)) {
      throw new Error("AI did not return a valid 'lessons' array in JSON");
    }

    // Add orgId and ids
    const tailoredLessons = parsed.lessons.map((l: any, idx: number) => ({
      ...l,
      id: `lesson-design-${orgId}-${Date.now()}-${idx}`,
      orgId,
      isAutoGenerated: true,
      generatedFromInstructions: instructions,
      sourceDocumentIds: orgMaterials.slice(0, 2).map((m: any) => m.id),
    }));

    return NextResponse.json({ lessons: tailoredLessons, message: "Tailored lessons generated successfully." });
  } catch (err: any) {
    console.error("Design lessons error:", err);
    return NextResponse.json({ 
      error: `AI generation failed: ${err.message}. The model may have returned invalid JSON. Try rephrasing your instructions (be specific and shorter) or check your OpenAI key/billing.`,
      lessons: [] 
    }, { status: 200 });
  }
}

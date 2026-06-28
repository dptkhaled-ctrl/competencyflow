import { NextResponse } from "next/server";
import { extractCompetencyDomains, suggestRelevantCategories } from "@/lib/ai/competency-extract";
import { callOpenAI } from "@/lib/ai/client";
import { getCategoriesForOrgType, mapCategoryToDomainId } from "@/lib/competency/domains";
import { prepareDocumentForAI } from "@/lib/ai/document-prep";
import { extractTextFromFile } from "@/lib/parsers";
import {
  addUploadedMaterial,
  appendCompetencyDomains,
  assignLessonsToUsers,
  readPlatform,
  saveUploadFile,
  updateUploadedMaterial,
  writePlatform,
} from "@/lib/server/data-store";
import type { DocumentChunk, Lesson, OrgType, UploadedMaterial } from "@/lib/types";

function tagWithDomains(
  lessons: Lesson[],
  chunks: DocumentChunk[],
  orgId: string,
  domains: Awaited<ReturnType<typeof appendCompetencyDomains>>
): { lessons: Lesson[]; chunks: DocumentChunk[] } {
  const taggedLessons = lessons.map((l) => ({
    ...l,
    competencyDomainId: mapCategoryToDomainId(orgId, l.category, domains),
  }));
  const taggedChunks = chunks.map((c) => {
    const lesson = taggedLessons.find((l) => l.sourceDocumentIds.includes(c.documentId));
    return {
      ...c,
      competencyDomainId: lesson?.competencyDomainId,
    };
  });
  return { lessons: taggedLessons, chunks: taggedChunks };
}

async function handleSuggest(body: any) {
  const { materialId, orgType } = body || {};
  if (!materialId || !orgType) {
    return NextResponse.json({ error: "materialId and orgType required for suggest" }, { status: 400 });
  }
  const platform = await readPlatform();
  const mat = (platform.uploadedMaterials || []).find((m: any) => m.id === materialId);
  if (!mat) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  const text = mat.extractedText || "";
  if (!text || text.length < 20) {
    return NextResponse.json({ suggested: [], note: "Not enough extracted text for AI suggestion" });
  }
  const suggested = await suggestRelevantCategories({
    orgType: orgType as OrgType,
    documentTitle: mat.fileName,
    rawText: text,
  });
  return NextResponse.json({ suggested });
}

async function handleConfirm(body: any) {
  const { materialId, orgId, categories } = body || {};
  if (!materialId || !orgId || !Array.isArray(categories) || categories.length === 0) {
    return NextResponse.json(
      { error: "materialId, orgId and non-empty categories[] are required" },
      { status: 400 }
    );
  }

  const platform = await readPlatform();
  const matIdx = (platform.uploadedMaterials || []).findIndex(
    (m: any) => m.id === materialId && m.orgId === orgId
  );
  if (matIdx === -1) {
    return NextResponse.json({ error: "Material not found for this org" }, { status: 404 });
  }

  const mat = platform.uploadedMaterials[matIdx];
  const text = mat.extractedText || "";

  // Generate lessons from *this document only*, constrained to the confirmed categories.
  // Follow practical action-first trainer rules: short high-impact lessons, bullets for what to do, scenario quizzes.
  const prepared = prepareDocumentForAI(text).slice(0, 8000);
  const catList = categories.join(", ");

  const org = platform.organizations.find((o: any) => o.id === orgId);
  const orgType = (org?.orgType as any) || "snf";
  const fullRequired = getCategoriesForOrgType(orgType);

  const genUserPrompt = `DOCUMENT: ${mat.fileName}
ORG: ${orgId} (${orgType})
THIS DOCUMENT'S CONFIRMED CATEGORIES (lesson "category" field MUST use exactly one value from this list; spread across multiple when the source supports it):
${catList}

FULL REQUIRED CATEGORIES FOR THIS FACILITY (context — aim for good coverage of supported ones):
${fullRequired.join(" | ")}

SOURCE EXCERPT (this document only — ground strictly):
---
${prepared}
---

Create 1-3 extremely practical micro-lessons (60–120 seconds, estimatedMinutes 1 or 2) for the confirmed categories.
Follow the expert frontline healthcare trainer rules:
- Only high-risk/high-frequency actions staff actually perform daily.
- Focus on WHAT TO DO right now (direct language, short • bullets or action steps in bodies). Do not restate policy.
- Action-oriented titles.
- Brief Why it matters in description or a slide.
- Quiz: 1 scenario-based Quick Check. Correct answer MUST be supported explicitly in the lesson's own slides.
- Skip low-value or unsupported items.

Return ONLY this JSON (no extra text):
{
  "lessons": [
    {
      "title": "string",
      "description": "string",
      "category": "Exact name from the confirmed list",
      "estimatedMinutes": 1,
      "slides": [ { "title": "string", "body": "string (bullets or direct action steps)" } ],
      "quiz": { "prompt": "string (scenario Quick Check)", "options": ["A","B","C","D"], "correctIndex": 0, "explanation": "string" }
    }
  ]
}`;

  let createdLessons: Lesson[] = [];
  let genErr: any = null;

  try {
    const raw = await callOpenAI({
      system:
        "You are an expert healthcare trainer specializing in short practical micro-lessons for frontline SNF, behavioral health, and home health staff. Turn source material into highly actionable lessons focused on what staff should DO. Prioritize high-risk/high-frequency. Use short bullets for key actions, brief why-it-matters, and scenario Quick Check quizzes. Ground strictly in provided text. Output strictly valid JSON only. Use exact category names from lists in the user prompt.",
      user: genUserPrompt,
      jsonMode: true,
      temperature: 0.2,
    });

    // Use more robust JSON cleaning (same as designer) to reduce parse failures
    let cleaned = raw.trim().replace(/```json/gi, "").replace(/```/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    let parsed;
    try {
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : cleaned);
    } catch (parseErr) {
      // Salvage common LLM JSON issues like trailing commas
      let salvaged = (jsonMatch ? jsonMatch[0] : cleaned).replace(/,\s*([}\]])/g, "$1");
      parsed = JSON.parse(salvaged);
    }
    const rawLs = Array.isArray(parsed?.lessons) ? parsed.lessons : [];

    const now = Date.now();
    createdLessons = rawLs.map((l: any, i: number) => {
      const cat = categories.includes(l.category) ? l.category : categories[0];
      const slides = (l.slides || []).slice(0, 3).map((s: any, si: number) => ({
        id: `s-${materialId}-${i}-${si}`,
        title: s.title || `Point ${si + 1}`,
        body: String(s.body || "").slice(0, 520),
        durationSeconds: s.durationSeconds || 45,
      }));
      const q = l.quiz || {};
      const quiz = [
        {
          id: `q-${materialId}-${i}`,
          prompt: q.prompt || `Key point from ${l.title || "the material"}?`,
          options: Array.isArray(q.options) && q.options.length === 4 ? q.options : ["Option A", "Option B", "Option C", "Option D"],
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
          explanation: q.explanation || "",
        },
      ];
      return {
        id: `lesson-cat-${materialId}-${now}-${i}`,
        orgId,
        title: l.title || `Training from ${mat.fileName}`,
        description: l.description || "",
        category: cat,
        estimatedMinutes: l.estimatedMinutes || 2,
        slides: slides.length
          ? slides
          : [
              {
                id: `s0-${i}`,
                title: "Key Points",
                body: (l.description || "Review the source policy or procedure.").slice(0, 200),
                durationSeconds: 60,
              },
            ],
        quiz,
        sourceDocumentIds: [materialId],
        isAutoGenerated: true,
        xpReward: 15,
        orderIndex: 200 + i,
        competencyDomainId: mapCategoryToDomainId(orgId, cat, platform.competencyDomains || []),
      } as Lesson;
    });
  } catch (err: any) {
    genErr = err;
    console.error("Confirm-categories lesson generation failed:", genErr);
  }

  // Write any successfully generated lessons (even if partial). This is independent of the material record.
  if (createdLessons.length > 0) {
    try {
      const existingIds = new Set(platform.lessons.map((l: any) => l.id));
      const fresh = createdLessons.filter((l) => !existingIds.has(l.id));
      platform.lessons.push(...fresh);
      await writePlatform(platform);

      const staffIds = platform.users
        .filter((u: any) => u.orgId === orgId && u.role === "staff")
        .map((u: any) => u.id);
      if (staffIds.length > 0 && fresh.length > 0) {
        await assignLessonsToUsers(
          fresh.map((l) => l.id),
          staffIds
        );
      }
    } catch (writeErr: any) {
      console.error("Failed to persist generated lessons or assignments during confirm:", writeErr);
      // Continue — we will still try to update the material record below.
    }
  }

  // IMPORTANT: Do the material update (assignedCategories + final status) ONLY at the end.
  // This avoids ever leaving the record in "processing" if generation or later steps fail.
  // The upload page uses local "confirming" state + spinner for in-progress UX.
  const finalLessonIds = Array.from(
    new Set([...(mat.lessonIds || []), ...createdLessons.map((l) => l.id)])
  );

  const finalStatus = genErr ? "error" : "ready";
  const finalProcessedAt = genErr ? undefined : new Date().toISOString();
  const finalErrorMessage = genErr ? (genErr.message || String(genErr)) : undefined;

  let materialUpdateOk = false;
  try {
    const updated = await updateUploadedMaterial(materialId, {
      assignedCategories: categories,
      status: finalStatus,
      processedAt: finalProcessedAt,
      lessonIds: finalLessonIds,
      errorMessage: finalErrorMessage,
    });
    materialUpdateOk = !!updated;
  } catch (finalUpdateErr: any) {
    console.error("Failed to update uploaded material (assignedCategories + status) after confirm:", finalUpdateErr);
    materialUpdateOk = false;
  }

  const baseMessage = genErr
    ? `Categories confirmed for the document. Lesson generation encountered an error (${genErr.message || "unknown"}). You can use the AI Lesson Designer to generate lessons manually.`
    : createdLessons.length > 0
      ? `Categories confirmed and ${createdLessons.length} lesson(s) generated for: ${categories.join(" + ")}. Assigned to staff.`
      : `Categories confirmed: ${categories.join(", ")}. (No new lessons generated from this document; use the AI Designer if needed.)`;

  const responseMessage = materialUpdateOk
    ? baseMessage
    : baseMessage + " (Note: there was a problem persisting the final status — refresh the organization page to see the latest.)";

  return NextResponse.json({
    ok: true,
    materialId,
    categories,
    lessonsCreated: createdLessons.length,
    materialUpdateOk,
    message: responseMessage,
  });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      if (body.action === "suggest") {
        return await handleSuggest(body);
      }
      if (body.action === "confirm") {
        return await handleConfirm(body);
      }
      return NextResponse.json({ error: "Unknown action. Supported: suggest, confirm" }, { status: 400 });
    }

    // Original file upload path (FormData) — only stores file + RAG chunks. No lessons until categories are confirmed by admin.
    const formData = await request.formData();
    const orgId = formData.get("orgId") as string;
    const file = formData.get("file") as File | null;

    if (!orgId || !file) {
      return NextResponse.json({ error: "orgId and file required" }, { status: 400 });
    }

    const platform = await readPlatform();
    const org = platform.organizations.find((o) => o.id === orgId);
    const docTitle = file.name.replace(/\.[^.]+$/, "");

    const fileId = `mat-${Date.now()}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = await saveUploadFile(orgId, fileId, file.name, buffer);

    let text = "";
    let fileType: UploadedMaterial["fileType"] = "unknown";

    try {
      const extracted = await extractTextFromFile(buffer, file.name, file.type);
      text = extracted.text;
      fileType = extracted.fileType;
    } catch (parseError) {
      const message =
        parseError instanceof Error
          ? parseError.message
          : "Could not read this file type";
      const material: UploadedMaterial = {
        id: fileId,
        orgId,
        fileName: file.name,
        fileType: "pdf",
        mimeType: file.type || "application/octet-stream",
        fileSize: file.size,
        storagePath,
        status: "error",
        uploadedAt: new Date().toISOString(),
        lessonIds: [],
        errorMessage: `File parsing failed: ${message}`,
      };
      await addUploadedMaterial(material);
      return NextResponse.json(
        {
          ok: false,
          error: "Could not read this file. Try PDF with selectable text or a Word document.",
          detail: message,
        },
        { status: 422 }
      );
    }

    const material: UploadedMaterial = {
      id: fileId,
      orgId,
      fileName: file.name,
      fileType,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
      storagePath,
      status: text.length > 20 ? "processing" : "uploaded",
      uploadedAt: new Date().toISOString(),
      extractedText: text.slice(0, 50000),
      lessonIds: [],
    };

    await addUploadedMaterial(material);

    // No longer auto-generate lessons on upload.
    // Uploads now only provide context (chunks for RAG) so the Admin AI Designer chat
    // can discuss and generate the exact lessons the admin wants.
    let chunksAdded = 0;

    if (text.length > 20) {
      // Create chunks from the text for RAG (chatbot + AI Designer context)
      const rawChunks = text
        .split(/\n\s*\n|\.\s+(?=[A-Z])/)
        .map((s) => s.trim())
        .filter((s) => s.length > 40)
        .slice(0, 25);

      const chunks: any[] = rawChunks.map((content, i) => ({
        id: `chunk-${fileId}-${i}`,
        orgId,
        documentId: fileId,
        documentTitle: docTitle,
        section: `Part ${i + 1}`,
        content: content.slice(0, 700),
        keywords: [],
      }));

      const platform = await readPlatform();
      platform.documentChunks = [...(platform.documentChunks || []), ...chunks];
      await writePlatform(platform);

      await updateUploadedMaterial(fileId, {
        status: "uploaded",
      });
      chunksAdded = chunks.length;
    } else {
      await updateUploadedMaterial(fileId, {
        status: "uploaded",
      });
    }

    return NextResponse.json({
      ok: true,
      materialId: fileId,
      fileName: file.name,
      fileType,
      textLength: text.length,
      chunksAdded,
      lessonsCreated: 0,
      usedAI: false,
      summary: "",
      message:
        chunksAdded > 0
          ? `File uploaded and indexed for AI context (${chunksAdded} chunks). Use the AI Lesson Designer in the org page to discuss and generate specific lessons from this content.`
          : "File uploaded. Use the AI Lesson Designer to create lessons from the organization's documents.",
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Something went wrong during upload. Please try again.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
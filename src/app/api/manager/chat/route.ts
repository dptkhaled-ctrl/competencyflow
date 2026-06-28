import { NextResponse } from "next/server";
import { buildManagerIntelligenceContext } from "@/lib/ai/manager-context";
import { generateFocusedLessonWithAI } from "@/lib/ai/lesson-generator";
import { generateManagerChatResponse } from "@/lib/ai/manager-chat";
import {
  appendOrgTraining,
  assignDomainToUsers,
  assignLessonsToUsers,
  readPlatform,
} from "@/lib/server/data-store";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, teamId, managerId, message } = body as {
      orgId?: string;
      teamId?: string;
      managerId?: string;
      message?: string;
    };

    if (!orgId || !teamId || !managerId || !message?.trim()) {
      return NextResponse.json(
        { error: "orgId, teamId, managerId, and message are required" },
        { status: 400 }
      );
    }

    const platform = await readPlatform();
    const intelligence = buildManagerIntelligenceContext(
      platform,
      orgId,
      teamId,
      managerId
    );

    const staff = platform.users.filter(
      (u) => u.orgId === orgId && u.teamId === teamId && u.role === "staff"
    );
    const orgLessons = platform.lessons.filter((l) => l.orgId === orgId);

    const aiResult = await generateManagerChatResponse(
      intelligence,
      message.trim()
    );

    const executedActions: Array<{ type: string; detail: string }> = [];

    for (const action of aiResult.actions) {
      if (action.type === "assign_lesson" && action.lessonId && action.userIds?.length) {
        const validUserIds = action.userIds.filter((id) =>
          staff.some((s) => s.id === id)
        );
        const lessonExists = orgLessons.some((l) => l.id === action.lessonId);
        if (validUserIds.length && lessonExists) {
          await assignLessonsToUsers([action.lessonId], validUserIds);
          const lesson = orgLessons.find((l) => l.id === action.lessonId);
          executedActions.push({
            type: "assign_lesson",
            detail: `Assigned "${lesson?.title}" to ${validUserIds.length} staff`,
          });
        }
      }

      if (
        action.type === "assign_domain" &&
        action.domainId &&
        action.userIds?.length
      ) {
        const validUserIds = action.userIds.filter((id) =>
          staff.some((s) => s.id === id)
        );
        const domain = platform.competencyDomains.find(
          (d) => d.id === action.domainId && d.orgId === orgId
        );
        if (validUserIds.length && domain) {
          await assignDomainToUsers(orgId, action.domainId, validUserIds, managerId);
          executedActions.push({
            type: "assign_domain",
            detail: `Assigned "${domain.name}" topic to ${validUserIds.length} staff`,
          });
        }
      }

      if (
        action.type === "create_lesson" &&
        action.materialId &&
        action.topic?.trim()
      ) {
        const material = platform.uploadedMaterials.find(
          (m) => m.id === action.materialId && m.orgId === orgId
        );
        const text = material?.extractedText ?? "";

        if (material && text.length > 20) {
          const maxOrder = orgLessons.reduce(
            (max, l) => Math.max(max, l.orderIndex ?? 0),
            0
          );
          const docTitle = material.fileName.replace(/\.[^.]+$/, "");
          const focused = await generateFocusedLessonWithAI({
            orgId,
            documentId: material.id,
            documentTitle: docTitle,
            rawText: text,
            topic: action.topic.trim(),
            startOrderIndex: maxOrder + 1,
          });

          if (focused) {
            const lessonIds = [focused.lesson.id];
            await appendOrgTraining(
              orgId,
              [focused.lesson],
              focused.chunks,
              material.id,
              lessonIds
            );

            const targetIds = (action.assignToUserIds ?? []).filter((id) =>
              staff.some((s) => s.id === id)
            );
            if (targetIds.length) {
              await assignLessonsToUsers(lessonIds, targetIds);
            }

            executedActions.push({
              type: "create_lesson",
              detail: `Created "${focused.lesson.title}" and assigned to ${targetIds.length || 0} staff`,
            });
          }
        }
      }
    }

    const updated = await readPlatform();

    return NextResponse.json({
      answer: aiResult.answer,
      actions: executedActions,
      lessons: updated.lessons.filter((l) => l.orgId === orgId),
      assignments: updated.assignments.filter((a) =>
        staff.some((s) => s.id === a.userId)
      ),
      domainAssignments: updated.domainAssignments.filter(
        (a) => a.orgId === orgId && staff.some((s) => s.id === a.userId)
      ),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Manager chat failed";
    if (msg.includes("OPENAI_API_KEY")) {
      return NextResponse.json({ error: msg }, { status: 503 });
    }
    if (msg.includes("429") || msg.toLowerCase().includes("quota")) {
      return NextResponse.json(
        { error: "OpenAI billing/quota issue. Check your account billing." },
        { status: 402 }
      );
    }
    console.error("Manager chat error:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
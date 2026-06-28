import { NextResponse } from "next/server";
import { readPlatform } from "@/lib/server/data-store";

/** Public read API — returns training data WITHOUT upload files or storage paths. */
export async function GET() {
  const data = await readPlatform();

  return NextResponse.json({
    organizations: data.organizations,
    teams: data.teams,
    users: data.users,
    lessons: data.lessons,
    assignments: data.assignments,
    progress: data.progress,
    streaks: data.streaks,
    userXp: data.userXp,
    incidents: data.incidents,
    lessonRequests: data.lessonRequests || [],
    documentChunks: data.documentChunks,
    competencyDomains: data.competencyDomains,
    competencyRecords: data.competencyRecords,
    assessmentEvents: data.assessmentEvents.map((e) => ({
      id: e.id,
      userId: e.userId,
      orgId: e.orgId,
      domainId: e.domainId,
      sessionId: e.sessionId,
      question: e.question,
      selectedIndex: e.selectedIndex,
      correctIndex: e.correctIndex,
      correct: e.correct,
      createdAt: e.createdAt,
    })),
    domainAssignments: data.domainAssignments,
    uploadedMaterials: data.uploadedMaterials.map((m) => ({
      id: m.id,
      orgId: m.orgId,
      fileName: m.fileName,
      status: m.status,
      lessonIds: m.lessonIds,
      uploadedAt: m.uploadedAt,
      fileType: m.fileType,
      fileSize: m.fileSize,
      managerRequestNote: m.managerRequestNote,
      managerId: m.managerId,
      managerName: m.managerName,
    })),
  });
}
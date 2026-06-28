import fs from "fs/promises";
import path from "path";
import { updateMasteryFromAssessment, getOrCreateRecord } from "@/lib/competency/mastery";
import { mergeExtractedDomains } from "@/lib/competency/domains";
import {
  createInitialPlatformData,
  migratePlatformData,
} from "@/lib/server/seed-platform";
import { DATA_DIR, PLATFORM_FILE, UPLOADS_DIR } from "@/lib/server/paths";
import { defaultDomainsForOrg, slugify } from "@/lib/competency/domains";
import type {
  AssessmentEvent,
  CompetencyDomain,
  DocumentChunk,
  Lesson,
  LessonAssignment,
  LessonRequest,
  Organization,
  OrgType,
  PlatformData,
  Team,
  TutorMessage,
  UploadedMaterial,
  User,
  UserRole,
} from "@/lib/types";

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}

export async function readPlatform(): Promise<PlatformData> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(PLATFORM_FILE, "utf-8");
    const parsed = JSON.parse(raw) as PlatformData;
    const migrated = migratePlatformData(parsed);
    const needsWrite =
      !parsed.competencyDomains ||
      !parsed.tutorMessages ||
      !parsed.organizations?.[0]?.orgType ||
      JSON.stringify(migrated) !== JSON.stringify(parsed);
    if (needsWrite) {
      await writePlatform(migrated);
    }
    return migrated;
  } catch {
    const initial = createInitialPlatformData();
    await writePlatform(initial);
    return initial;
  }
}

export async function writePlatform(data: PlatformData): Promise<void> {
  await ensureDirs();
  await fs.writeFile(PLATFORM_FILE, JSON.stringify(data, null, 2), "utf-8");
}

export async function saveUploadFile(
  orgId: string,
  fileId: string,
  fileName: string,
  buffer: Buffer
): Promise<string> {
  const orgDir = path.join(UPLOADS_DIR, orgId);
  await fs.mkdir(orgDir, { recursive: true });
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = path.join(orgDir, `${fileId}-${safeName}`);
  await fs.writeFile(storagePath, buffer);
  return storagePath;
}

export async function addUploadedMaterial(
  material: UploadedMaterial
): Promise<PlatformData> {
  const data = await readPlatform();
  data.uploadedMaterials = [material, ...data.uploadedMaterials];
  await writePlatform(data);
  return data;
}

export async function submitManagerMaterials(input: {
  orgId: string;
  managerId: string;
  managerName: string;
  requestNote: string;
  files: Array<{
    fileName: string;
    mimeType: string;
    fileType: UploadedMaterial["fileType"];
    fileSize: number;
    buffer: Buffer;
  }>;
}): Promise<UploadedMaterial[]> {
  const created: UploadedMaterial[] = [];
  const now = new Date().toISOString();

  for (const file of input.files) {
    const fileId = `mat-mgr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const storagePath = await saveUploadFile(
      input.orgId,
      fileId,
      file.fileName,
      file.buffer
    );
    const material: UploadedMaterial = {
      id: fileId,
      orgId: input.orgId,
      fileName: file.fileName,
      fileType: file.fileType,
      mimeType: file.mimeType,
      fileSize: file.fileSize,
      storagePath,
      status: "submitted_by_manager",
      uploadedAt: now,
      lessonIds: [],
      managerRequestNote: input.requestNote,
      managerId: input.managerId,
      managerName: input.managerName,
    };
    await addUploadedMaterial(material);
    created.push(material);
  }

  // Text-only request (no files) — still create a trackable admin record
  if (input.files.length === 0 && input.requestNote.trim()) {
    const fileId = `mat-mgr-note-${Date.now()}`;
    const material: UploadedMaterial = {
      id: fileId,
      orgId: input.orgId,
      fileName: "manager-request.txt",
      fileType: "text",
      mimeType: "text/plain",
      fileSize: input.requestNote.length,
      storagePath: "",
      status: "submitted_by_manager",
      uploadedAt: now,
      lessonIds: [],
      managerRequestNote: input.requestNote,
      managerId: input.managerId,
      managerName: input.managerName,
    };
    await addUploadedMaterial(material);
    created.push(material);
  }

  return created;
}

export async function clearManagerRequestFlags(
  materialId: string
): Promise<UploadedMaterial | null> {
  return updateUploadedMaterial(materialId, {
    managerRequestNote: undefined,
    managerId: undefined,
    managerName: undefined,
  });
}

export async function updateUploadedMaterial(
  id: string,
  patch: Partial<UploadedMaterial>
): Promise<UploadedMaterial | null> {
  const data = await readPlatform();
  const idx = data.uploadedMaterials.findIndex((m) => m.id === id);
  if (idx === -1) return null;
  data.uploadedMaterials[idx] = { ...data.uploadedMaterials[idx], ...patch };
  await writePlatform(data);
  return data.uploadedMaterials[idx];
}

/**
 * Appends training from a new upload without removing existing lessons or progress.
 */
export async function appendOrgTraining(
  orgId: string,
  lessons: Lesson[],
  chunks: DocumentChunk[],
  materialId: string,
  lessonIds: string[]
): Promise<PlatformData> {
  const data = await readPlatform();
  const staffIds = data.users
    .filter((u) => u.orgId === orgId && u.role === "staff")
    .map((u) => u.id);
  const today = new Date().toISOString().split("T")[0];

  const existingLessonIds = new Set(data.lessons.map((l) => l.id));
  const newLessons = lessons.filter((l) => !existingLessonIds.has(l.id));
  data.lessons.push(...newLessons);

  const existingChunkIds = new Set(data.documentChunks.map((c) => c.id));
  const newChunks = chunks.filter((c) => !existingChunkIds.has(c.id));
  data.documentChunks.push(...newChunks);

  const existingAssignmentKeys = new Set(
    data.assignments.map((a) => `${a.lessonId}:${a.userId}`)
  );
  for (const lessonId of lessonIds) {
    for (const userId of staffIds) {
      const key = `${lessonId}:${userId}`;
      if (existingAssignmentKeys.has(key)) continue;
      data.assignments.push({
        id: `asgn-${lessonId}-${userId}`,
        lessonId,
        userId,
        assignedAt: today,
      });
      existingAssignmentKeys.add(key);
    }
  }

  const matIdx = data.uploadedMaterials.findIndex((m) => m.id === materialId);
  if (matIdx !== -1) {
    const existing = data.uploadedMaterials[matIdx];
    data.uploadedMaterials[matIdx] = {
      ...existing,
      status: "ready",
      processedAt: new Date().toISOString(),
      lessonIds: [...new Set([...existing.lessonIds, ...lessonIds])],
    };
  }

  await writePlatform(data);
  return data;
}

export async function assignLessonsToUsers(
  lessonIds: string[],
  userIds: string[]
): Promise<PlatformData> {
  const data = await readPlatform();
  const today = new Date().toISOString().split("T")[0];
  const existing = new Set(data.assignments.map((a) => `${a.lessonId}:${a.userId}`));

  for (const lessonId of lessonIds) {
    for (const userId of userIds) {
      const key = `${lessonId}:${userId}`;
      if (existing.has(key)) continue;
      data.assignments.push({
        id: `asgn-${lessonId}-${userId}-${Date.now()}`,
        lessonId,
        userId,
        assignedAt: today,
      });
      existing.add(key);
    }
  }

  await writePlatform(data);
  return data;
}

export async function addLessonAndAssign(
  lesson: Lesson,
  userIds: string[],
  options?: { dueAt?: string }
): Promise<{ lesson: Lesson; assignments: LessonAssignment[] }> {
  const data = await readPlatform();
  const today = new Date().toISOString().split("T")[0];

  if (!data.lessons.some((l) => l.id === lesson.id)) {
    const maxOrder = data.lessons
      .filter((l) => l.orgId === lesson.orgId)
      .reduce((max, l) => Math.max(max, l.orderIndex ?? 0), 0);
    data.lessons.push({
      ...lesson,
      orderIndex: lesson.orderIndex ?? maxOrder + 1,
    });
  }

  const existingKeys = new Set(
    data.assignments.map((a) => `${a.lessonId}:${a.userId}`)
  );
  const newAssignments: LessonAssignment[] = [];

  for (const userId of userIds) {
    const key = `${lesson.id}:${userId}`;
    if (existingKeys.has(key)) continue;
    const assignment: LessonAssignment = {
      id: `asgn-${lesson.id}-${userId}-${Date.now()}`,
      lessonId: lesson.id,
      userId,
      assignedAt: today,
      ...(options?.dueAt ? { dueAt: options.dueAt } : {}),
    };
    data.assignments.push(assignment);
    newAssignments.push(assignment);
    existingKeys.add(key);
  }

  await writePlatform(data);
  return { lesson, assignments: newAssignments };
}

export async function updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<Lesson | null> {
  const data = await readPlatform();
  const idx = data.lessons.findIndex((l) => l.id === lessonId);
  if (idx === -1) return null;

  data.lessons[idx] = {
    ...data.lessons[idx],
    ...updates,
  } as Lesson;

  await writePlatform(data);
  return data.lessons[idx];
}

export async function removeLesson(lessonId: string): Promise<boolean> {
  const data = await readPlatform();
  const initialCount = data.lessons.length;

  data.lessons = data.lessons.filter((l) => l.id !== lessonId);
  data.assignments = data.assignments.filter((a) => a.lessonId !== lessonId);
  // Keep progress records for historical stats; only remove active assignments

  await writePlatform(data);
  return data.lessons.length < initialCount;
}

export async function deleteUploadedMaterial(
  materialId: string,
  deleteLessons: boolean
): Promise<{ ok: boolean; error?: string }> {
  const data = await readPlatform();
  const material = data.uploadedMaterials.find((m) => m.id === materialId);
  if (!material) return { ok: false, error: "File not found" };

  if (deleteLessons && material.lessonIds.length > 0) {
    const lessonIdSet = new Set(material.lessonIds);
    data.lessons = data.lessons.filter((l) => !lessonIdSet.has(l.id));
    data.assignments = data.assignments.filter((a) => !lessonIdSet.has(a.lessonId));
    data.progress = data.progress.filter((p) => !lessonIdSet.has(p.lessonId));
  }

  data.documentChunks = data.documentChunks.filter((c) => c.documentId !== materialId);
  data.uploadedMaterials = data.uploadedMaterials.filter((m) => m.id !== materialId);

  try {
    await fs.unlink(material.storagePath);
  } catch {
    // File may already be missing on disk
  }

  await writePlatform(data);
  return { ok: true };
}

/**
 * Replaces ALL training for an org with the new upload only.
 * Removes seed lessons, old generated lessons, stale progress & assignments.
 */
export async function replaceOrgTraining(
  orgId: string,
  lessons: Lesson[],
  chunks: DocumentChunk[],
  materialId: string,
  lessonIds: string[]
): Promise<PlatformData> {
  const data = await readPlatform();
  const staffIds = data.users
    .filter((u) => u.orgId === orgId && u.role === "staff")
    .map((u) => u.id);
  const today = new Date().toISOString().split("T")[0];

  data.lessons = data.lessons.filter((l) => l.orgId !== orgId);
  data.lessons.push(...lessons);

  data.documentChunks = data.documentChunks.filter((c) => c.orgId !== orgId);
  data.documentChunks.push(...chunks);

  data.assignments = data.assignments.filter((a) => !staffIds.includes(a.userId));
  for (const lessonId of lessonIds) {
    for (const userId of staffIds) {
      data.assignments.push({
        id: `asgn-${lessonId}-${userId}`,
        lessonId,
        userId,
        assignedAt: today,
      });
    }
  }

  data.progress = data.progress.filter((p) => !staffIds.includes(p.userId));

  for (const xp of data.userXp) {
    if (staffIds.includes(xp.userId)) {
      xp.totalXp = 0;
      xp.level = 1;
      xp.dailyXp = 0;
      xp.lastXpDate = today;
    }
  }

  data.uploadedMaterials = data.uploadedMaterials.filter(
    (m) => m.orgId !== orgId || m.id === materialId
  );

  const matIdx = data.uploadedMaterials.findIndex((m) => m.id === materialId);
  if (matIdx !== -1) {
    data.uploadedMaterials[matIdx] = {
      ...data.uploadedMaterials[matIdx],
      status: "ready",
      processedAt: new Date().toISOString(),
      lessonIds,
    };
  }

  await writePlatform(data);
  return data;
}

/** Reset an org to only the lessons from its most recent successful upload. */
export async function resetOrgToLatestUpload(orgId: string): Promise<boolean> {
  const data = await readPlatform();
  const latest = data.uploadedMaterials
    .filter((m) => m.orgId === orgId && m.lessonIds.length > 0)
    .sort(
      (a, b) =>
        new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];

  if (!latest) return false;

  const keepLessons = data.lessons.filter((l) =>
    latest.lessonIds.includes(l.id)
  );
  const keepChunks = data.documentChunks.filter(
    (c) => c.documentId === latest.id
  );

  await replaceOrgTraining(
    orgId,
    keepLessons,
    keepChunks,
    latest.id,
    latest.lessonIds
  );
  return true;
}

export async function addLessonsAndChunks(
  lessons: Lesson[],
  chunks: DocumentChunk[],
  materialId: string,
  lessonIds: string[]
): Promise<PlatformData> {
  const orgId = lessons[0]?.orgId;
  if (!orgId) {
    const data = await readPlatform();
    await writePlatform(data);
    return data;
  }

  const data = await readPlatform();
  const maxOrder = data.lessons
    .filter((l) => l.orgId === orgId)
    .reduce((max, l) => Math.max(max, l.orderIndex ?? 0), 0);

  const orderedLessons = lessons.map((l, i) => ({
    ...l,
    orderIndex: maxOrder + i + 1,
  }));

  return appendOrgTraining(orgId, orderedLessons, chunks, materialId, lessonIds);
}

export function getOrgUploadDir(orgId: string): string {
  return path.join(UPLOADS_DIR, orgId);
}

export async function appendCompetencyDomains(
  orgId: string,
  extracted: Array<{ name: string; description?: string }>,
  documentId: string
): Promise<CompetencyDomain[]> {
  const data = await readPlatform();
  data.competencyDomains = mergeExtractedDomains(
    orgId,
    extracted,
    data.competencyDomains,
    documentId
  );
  await writePlatform(data);
  return data.competencyDomains.filter((d) => d.orgId === orgId);
}

export async function getOrCreateSession(
  userId: string,
  orgId: string
): Promise<{ sessionId: string; isNew: boolean }> {
  const data = await readPlatform();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const active = data.learningSessions.find(
    (s) =>
      s.userId === userId &&
      new Date(s.lastActiveAt).getTime() > hourAgo
  );

  if (active) {
    active.lastActiveAt = new Date().toISOString();
    await writePlatform(data);
    return { sessionId: active.id, isNew: false };
  }

  const sessionId = `session-${userId}-${Date.now()}`;
  data.learningSessions.push({
    id: sessionId,
    userId,
    orgId,
    startedAt: new Date().toISOString(),
    lastActiveAt: new Date().toISOString(),
    topicsCovered: [],
    assessmentCount: 0,
  });
  await writePlatform(data);
  return { sessionId, isNew: true };
}

export async function saveTutorMessages(
  messages: TutorMessage[]
): Promise<void> {
  const data = await readPlatform();
  data.tutorMessages.push(...messages);
  if (data.tutorMessages.length > 5000) {
    data.tutorMessages = data.tutorMessages.slice(-4000);
  }
  await writePlatform(data);
}

export async function getTutorMessagesForUser(
  userId: string,
  limit = 50
): Promise<TutorMessage[]> {
  const data = await readPlatform();
  return data.tutorMessages
    .filter((m) => m.userId === userId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .slice(-limit);
}

export async function checkTutorRateLimit(userId: string): Promise<boolean> {
  const limit = Number(process.env.TUTOR_RATE_LIMIT ?? 30);
  const data = await readPlatform();
  const hourAgo = Date.now() - 60 * 60 * 1000;
  const recent = data.tutorMessages.filter(
    (m) =>
      m.userId === userId &&
      m.role === "user" &&
      new Date(m.createdAt).getTime() > hourAgo
  );
  return recent.length < limit;
}

export async function recordAssessment(event: Omit<AssessmentEvent, "id">): Promise<{
  record: ReturnType<typeof updateMasteryFromAssessment>;
  xpEarned: number;
  assessmentEvent: AssessmentEvent;
}> {
  const data = await readPlatform();
  const id = `assess-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const assessmentEvent: AssessmentEvent = { ...event, id };
  data.assessmentEvents.push(assessmentEvent);

  const existing = getOrCreateRecord(
    data.competencyRecords,
    event.userId,
    event.domainId
  );
  const updated = updateMasteryFromAssessment(existing, event.correct);
  const idx = data.competencyRecords.findIndex(
    (r) => r.userId === event.userId && r.domainId === event.domainId
  );
  if (idx >= 0) data.competencyRecords[idx] = updated;
  else data.competencyRecords.push(updated);

  const session = data.learningSessions.find((s) => s.id === event.sessionId);
  if (session) {
    session.assessmentCount += 1;
    session.lastActiveAt = new Date().toISOString();
  }

  const xpEarned = event.correct ? 15 : 5;
  const xpIdx = data.userXp.findIndex((x) => x.userId === event.userId);
  if (xpIdx >= 0) {
    data.userXp[xpIdx].totalXp += xpEarned;
    data.userXp[xpIdx].dailyXp += xpEarned;
    data.userXp[xpIdx].lastXpDate = new Date().toISOString().split("T")[0];
  }

  await writePlatform(data);
  return { record: updated, xpEarned, assessmentEvent };
}

export async function assignDomainToUsers(
  orgId: string,
  domainId: string,
  userIds: string[],
  assignedBy: string
): Promise<void> {
  const data = await readPlatform();
  const today = new Date().toISOString().split("T")[0];
  const existing = new Set(
    data.domainAssignments.map((a) => `${a.domainId}:${a.userId}`)
  );

  for (const userId of userIds) {
    const key = `${domainId}:${userId}`;
    if (existing.has(key)) continue;
    data.domainAssignments.push({
      id: `dasgn-${domainId}-${userId}`,
      orgId,
      domainId,
      userId,
      assignedBy,
      assignedAt: today,
    });
  }

  await writePlatform(data);
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export async function createOrganization(input: {
  name: string;
  industry: string;
  orgType?: OrgType;
  teamName?: string;
}): Promise<{ org: Organization; team: Team }> {
  const data = await readPlatform();
  const id = `org-${slugify(input.name)}-${Date.now().toString(36)}`;
  const orgType = input.orgType ?? "snf";

  const org: Organization = {
    id,
    name: input.name.trim(),
    industry: input.industry.trim(),
    orgType,
  };

  const team: Team = {
    id: `team-${id}-main`,
    orgId: id,
    name: input.teamName?.trim() || "Main Team",
  };

  data.organizations.push(org);
  data.teams.push(team);
  data.competencyDomains.push(...defaultDomainsForOrg(id, orgType));
  await writePlatform(data);
  return { org, team };
}

export async function updateOrganization(
  id: string,
  patch: Partial<
    Pick<Organization, "name" | "industry" | "orgType" | "refresherRotationEnabled">
  >
): Promise<Organization | null> {
  const data = await readPlatform();
  const idx = data.organizations.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  data.organizations[idx] = { ...data.organizations[idx], ...patch };
  await writePlatform(data);
  return data.organizations[idx];
}

export async function deleteOrganization(id: string): Promise<{ ok: boolean; error?: string }> {
  const data = await readPlatform();
  if (!data.organizations.some((o) => o.id === id)) {
    return { ok: false, error: "Organization not found" };
  }
  const userIds = new Set(data.users.filter((u) => u.orgId === id).map((u) => u.id));
  data.organizations = data.organizations.filter((o) => o.id !== id);
  data.teams = data.teams.filter((t) => t.orgId !== id);
  data.users = data.users.filter((u) => u.orgId !== id);
  data.lessons = data.lessons.filter((l) => l.orgId !== id);
  data.documentChunks = data.documentChunks.filter((c) => c.orgId !== id);
  data.uploadedMaterials = data.uploadedMaterials.filter((m) => m.orgId !== id);
  data.competencyDomains = data.competencyDomains.filter((d) => d.orgId !== id);
  data.competencyRecords = data.competencyRecords.filter((r) => !userIds.has(r.userId));
  data.assessmentEvents = data.assessmentEvents.filter((e) => !userIds.has(e.userId));
  await writePlatform(data);
  return { ok: true };
}

const DEFAULT_SIGNUP_ORG_ID = "org-snf-demo";
const DEFAULT_SIGNUP_TEAM_ID = "team-snf-main";

export async function findUserByAuthUserId(
  authUserId: string
): Promise<User | null> {
  const data = await readPlatform();
  return data.users.find((u) => u.authUserId === authUserId) ?? null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const data = await readPlatform();
  const normalized = email.trim().toLowerCase();
  return (
    data.users.find((u) => u.email.trim().toLowerCase() === normalized) ?? null
  );
}

export async function findUserByPhone(phone: string): Promise<User | null> {
  const data = await readPlatform();
  const normalized = phone.replace(/\D/g, "");
  return (
    data.users.find(
      (u) => u.phone && u.phone.replace(/\D/g, "") === normalized
    ) ?? null
  );
}

export async function linkAuthUser(input: {
  authUserId: string;
  platformUserId: string;
  phone?: string;
}): Promise<User | null> {
  const data = await readPlatform();
  const index = data.users.findIndex((u) => u.id === input.platformUserId);
  if (index < 0) return null;

  data.users[index] = {
    ...data.users[index],
    authUserId: input.authUserId,
    phone: input.phone ?? data.users[index].phone,
  };
  await writePlatform(data);
  return data.users[index];
}

export async function provisionAuthUser(input: {
  authUserId: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  orgId?: string;
  teamId?: string;
}): Promise<User | null> {
  const existing = await findUserByAuthUserId(input.authUserId);
  if (existing) return existing;

  if (input.email) {
    const byEmail = await findUserByEmail(input.email);
    if (byEmail) {
      return linkAuthUser({
        authUserId: input.authUserId,
        platformUserId: byEmail.id,
        phone: input.phone,
      });
    }
  }

  if (input.phone) {
    const byPhone = await findUserByPhone(input.phone);
    if (byPhone) {
      return linkAuthUser({
        authUserId: input.authUserId,
        platformUserId: byPhone.id,
        phone: input.phone,
      });
    }
  }

  return createUser({
    orgId: input.orgId ?? DEFAULT_SIGNUP_ORG_ID,
    teamId: input.teamId ?? DEFAULT_SIGNUP_TEAM_ID,
    name: input.name,
    email: input.email?.trim() || `${input.authUserId}@competencyflow.local`,
    role: input.role,
  }).then(async (user) => {
    if (!user) return null;
    return linkAuthUser({
      authUserId: input.authUserId,
      platformUserId: user.id,
      phone: input.phone,
    });
  });
}

export async function createUser(input: {
  orgId: string;
  teamId: string;
  name: string;
  email: string;
  role: UserRole;
  jobTitle?: string;
  priorityCategories?: string[];
  phone?: string;
  authUserId?: string;
}): Promise<User | null> {
  const data = await readPlatform();
  if (!data.organizations.some((o) => o.id === input.orgId)) return null;
  if (!data.teams.some((t) => t.id === input.teamId && t.orgId === input.orgId)) return null;

  const user: User = {
    id: `user-${Date.now().toString(36)}`,
    orgId: input.orgId,
    teamId: input.teamId,
    name: input.name.trim(),
    email: input.email.trim(),
    phone: input.phone,
    authUserId: input.authUserId,
    role: input.role,
    avatarInitials: initialsFromName(input.name) || "??",
    jobTitle: input.jobTitle,
    priorityCategories: input.priorityCategories || [],
  };

  data.users.push(user);
  if (user.role === "staff") {
    data.userXp.push({
      userId: user.id,
      totalXp: 0,
      level: 1,
      dailyXp: 0,
      dailyGoal: 50,
      lastXpDate: new Date().toISOString().split("T")[0],
    });
    data.streaks.push({
      userId: user.id,
      currentStreak: 0,
      longestStreak: 0,
      lastActivityDate: new Date().toISOString().split("T")[0],
    });

    // Auto-assign org lessons, but respect priorityCategories if provided (role-based assignment)
    const priorities = input.priorityCategories && input.priorityCategories.length > 0
      ? new Set(input.priorityCategories)
      : null;
    const orgLessons = data.lessons.filter((l) => l.orgId === input.orgId);
    if (orgLessons.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const existingKeys = new Set(
        data.assignments.map((a) => `${a.lessonId}:${a.userId}`)
      );
      for (const lesson of orgLessons) {
        if (priorities && !priorities.has(lesson.category || "")) continue;
        const key = `${lesson.id}:${user.id}`;
        if (!existingKeys.has(key)) {
          data.assignments.push({
            id: `asgn-${lesson.id}-${user.id}-${Date.now().toString(36)}`,
            lessonId: lesson.id,
            userId: user.id,
            assignedAt: today,
          });
          existingKeys.add(key);
        }
      }
    }
  }
  await writePlatform(data);
  return user;
}

export async function createLessonRequest(
  input: Omit<LessonRequest, 'id' | 'status' | 'createdAt' | 'approvedLessonId'>
): Promise<LessonRequest> {
  const data = await readPlatform();
  const request: LessonRequest = {
    id: `req-${Date.now().toString(36)}`,
    ...input,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  if (!data.lessonRequests) data.lessonRequests = [];
  data.lessonRequests.push(request);
  await writePlatform(data);
  return request;
}

export async function getLessonRequests(orgId: string): Promise<LessonRequest[]> {
  const data = await readPlatform();
  return (data.lessonRequests || []).filter((r) => r.orgId === orgId);
}

export async function approveLessonRequest(
  requestId: string,
  lesson: Lesson,
  assignToStaff: string[] = []
): Promise<{ request: LessonRequest; lesson: Lesson }> {
  const data = await readPlatform();
  if (!data.lessonRequests) data.lessonRequests = [];
  const reqIdx = data.lessonRequests.findIndex((r) => r.id === requestId);
  if (reqIdx === -1) throw new Error('Request not found');

  const request = data.lessonRequests[reqIdx];
  request.status = 'approved';
  request.approvedLessonId = lesson.id;

  // Add the lesson if not present
  if (!data.lessons.find((l) => l.id === lesson.id)) {
    data.lessons.push(lesson);
  }

  // Assign if requested
  if (assignToStaff.length > 0) {
    const today = new Date().toISOString().split('T')[0];
    const existingKeys = new Set(data.assignments.map((a) => `${a.lessonId}:${a.userId}`));
    for (const userId of assignToStaff) {
      const key = `${lesson.id}:${userId}`;
      if (!existingKeys.has(key)) {
        data.assignments.push({
          id: `asgn-${lesson.id}-${userId}-${Date.now()}`,
          lessonId: lesson.id,
          userId,
          assignedAt: today,
        });
      }
    }
  }

  await writePlatform(data);
  return { request, lesson };
}

export async function rejectLessonRequest(requestId: string): Promise<LessonRequest> {
  const data = await readPlatform();
  if (!data.lessonRequests) data.lessonRequests = [];
  const reqIdx = data.lessonRequests.findIndex((r) => r.id === requestId);
  if (reqIdx === -1) throw new Error('Request not found');

  const request = data.lessonRequests[reqIdx];
  request.status = 'rejected';

  await writePlatform(data);
  return request;
}

export async function createStaffUser(input: {
  orgId: string;
  teamId: string;
  name: string;
  email: string;
  jobTitle?: string;
  priorityCategories?: string[];
}): Promise<User | null> {
  const data = await readPlatform();
  if (!data.organizations.some((o) => o.id === input.orgId)) return null;
  if (!data.teams.some((t) => t.id === input.teamId && t.orgId === input.orgId)) return null;

  const user: User = {
    id: `user-${Date.now().toString(36)}`,
    orgId: input.orgId,
    teamId: input.teamId,
    name: input.name.trim(),
    email: input.email.trim(),
    role: "staff",
    avatarInitials: initialsFromName(input.name) || "??",
    jobTitle: input.jobTitle,
    priorityCategories: input.priorityCategories || [],
  };

  data.users.push(user);
  data.userXp.push({
    userId: user.id,
    totalXp: 0,
    level: 1,
    dailyXp: 0,
    dailyGoal: 50,
    lastXpDate: new Date().toISOString().split("T")[0],
  });
  data.streaks.push({
    userId: user.id,
    currentStreak: 0,
    longestStreak: 0,
    lastActivityDate: new Date().toISOString().split("T")[0],
  });

  await writePlatform(data);
  return user;
}

export async function deleteStaffUser(userId: string): Promise<boolean> {
  const data = await readPlatform();
  const initialUsers = data.users.length;
  data.users = data.users.filter((u) => u.id !== userId);
  data.userXp = data.userXp.filter((x) => x.userId !== userId);
  data.streaks = data.streaks.filter((s) => s.userId !== userId);
  data.progress = data.progress.filter((p) => p.userId !== userId);
  data.assignments = data.assignments.filter((a) => a.userId !== userId);
  data.competencyRecords = data.competencyRecords.filter((r) => r.userId !== userId);
  data.assessmentEvents = data.assessmentEvents.filter((e) => e.userId !== userId);
  // Note: does not delete chat history or requests

  await writePlatform(data);
  return data.users.length < initialUsers;
}

export async function updateUserPriorities(userId: string, priorityCategories: string[]): Promise<User | null> {
  const data = await readPlatform();
  const idx = data.users.findIndex((u) => u.id === userId);
  if (idx === -1) return null;

  data.users[idx] = { ...data.users[idx], priorityCategories };
  await writePlatform(data);
  return data.users[idx];
}

export async function updateUser(
  id: string,
  patch: Partial<
    Pick<
      User,
      | "name"
      | "email"
      | "role"
      | "orgId"
      | "teamId"
      | "avatarInitials"
      | "jobTitle"
      | "priorityCategories"
      | "refresherIntervalDays"
      | "refresherIntervals"
    >
  >
): Promise<User | null> {
  const data = await readPlatform();
  const idx = data.users.findIndex((u) => u.id === id);
  if (idx === -1) return null;

  const updates = { ...patch };
  if (patch.name) {
    updates.avatarInitials = initialsFromName(patch.name);
  }
  data.users[idx] = { ...data.users[idx], ...updates };
  await writePlatform(data);
  return data.users[idx];
}

export async function deleteUser(id: string): Promise<{ ok: boolean }> {
  const data = await readPlatform();
  data.users = data.users.filter((u) => u.id !== id);
  data.assignments = data.assignments.filter((a) => a.userId !== id);
  data.progress = data.progress.filter((p) => p.userId !== id);
  data.streaks = data.streaks.filter((s) => s.userId !== id);
  data.userXp = data.userXp.filter((x) => x.userId !== id);
  data.competencyRecords = data.competencyRecords.filter((r) => r.userId !== id);
  data.assessmentEvents = data.assessmentEvents.filter((e) => e.userId !== id);
  data.tutorMessages = data.tutorMessages.filter((m) => m.userId !== id);
  await writePlatform(data);
  return { ok: true };
}

export async function updateCompetencyDomain(
  domainId: string,
  patch: Partial<Pick<CompetencyDomain, "refresherIntervalDays" | "description" | "name">>
): Promise<CompetencyDomain | null> {
  const data = await readPlatform();
  const idx = data.competencyDomains.findIndex((d) => d.id === domainId);
  if (idx === -1) return null;

  data.competencyDomains[idx] = { ...data.competencyDomains[idx], ...patch };
  await writePlatform(data);
  return data.competencyDomains[idx];
}

export async function createTeam(orgId: string, name: string): Promise<Team | null> {
  const data = await readPlatform();
  if (!data.organizations.some((o) => o.id === orgId)) return null;
  const team: Team = {
    id: `team-${orgId}-${Date.now().toString(36)}`,
    orgId,
    name: name.trim(),
  };
  data.teams.push(team);
  await writePlatform(data);
  return team;
}

export function getOrgDetail(data: PlatformData, orgId: string) {
  const org = data.organizations.find((o) => o.id === orgId);
  if (!org) return null;

  return {
    organization: org,
    teams: data.teams.filter((t) => t.orgId === orgId),
    users: data.users.filter((u) => u.orgId === orgId),
    uploadedMaterials: data.uploadedMaterials
      .filter((m) => m.orgId === orgId)
      .map((m) => ({
        id: m.id,
        fileName: m.fileName,
        fileType: m.fileType,
        fileSize: m.fileSize,
        status: m.status,
        lessonIds: m.lessonIds,
        uploadedAt: m.uploadedAt,
        processedAt: m.processedAt,
        errorMessage: m.errorMessage,
        assignedCategories: m.assignedCategories,
      })),
    lessons: data.lessons.filter((l) => l.orgId === orgId),
    competencyDomains: data.competencyDomains.filter((d) => d.orgId === orgId),
    staffCount: data.users.filter((u) => u.orgId === orgId && u.role === "staff").length,
    managerCount: data.users.filter((u) => u.orgId === orgId && u.role === "manager").length,
  };
}
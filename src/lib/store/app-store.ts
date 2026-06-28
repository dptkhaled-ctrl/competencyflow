"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  assignments as seedAssignments,
  initialIncidents,
  initialProgress,
  initialStreaks,
  lessons as seedLessons,
  users as seedUsers,
} from "@/lib/data/seed";
import { awardXp, defaultUserXp } from "@/lib/gamification/xp";
import { generateRefresherLesson } from "@/lib/incidents/generate-lesson";
import {
  organizations as seedOrganizations,
  teams as seedTeams,
} from "@/lib/data/seed";
import type {
  AssessmentEvent,
  ChatMessage,
  CompetencyDomain,
  CompetencyRecord,
  DocumentChunk,
  DomainAssignment,
  Incident,
  IncidentSeverity,
  Lesson,
  LessonAssignment,
  LessonRequest,
  LessonProgress,
  Organization,
  SavedPolicyAnswer,
  Streak,
  Team,
  UploadedMaterial,
  User,
  UserXP,
} from "@/lib/types";

interface AppState {
  currentUserId: string;
  organizations: Organization[];
  teams: Team[];
  users: User[];
  lessons: Lesson[];
  assignments: LessonAssignment[];
  progress: LessonProgress[];
  streaks: Streak[];
  userXp: UserXP[];
  incidents: Incident[];
  lessonRequests: LessonRequest[];
  documentChunks: DocumentChunk[];
  uploadedMaterials: Array<
    Pick<UploadedMaterial, "id" | "orgId" | "fileName" | "lessonIds" | "uploadedAt"> & {
      managerRequestNote?: string;
      managerId?: string;
      managerName?: string;
    }
  >;
  competencyDomains: CompetencyDomain[];
  competencyRecords: CompetencyRecord[];
  assessmentEvents: AssessmentEvent[];
  domainAssignments: DomainAssignment[];
  chatMessages: Record<string, ChatMessage[]>;
  managerChatMessages: Record<string, ChatMessage[]>;
  savedShortcuts: Record<string, string[]>;
  savedPolicyAnswers: Record<string, SavedPolicyAnswer[]>;
  pendingAskQuestion: string | null;
  hydrated: boolean;

  setCurrentUser: (userId: string) => void;
  hydrateFromServer: () => Promise<void>;
  syncToServer: (payload: {
    progress?: LessonProgress;
    streak?: Streak;
    userXp?: UserXP;
  }) => void;

  startLesson: (lessonId: string) => void;
  advanceSlide: (lessonId: string) => void;
  completeQuiz: (lessonId: string, score: number) => void;

  addChatMessage: (userId: string, message: ChatMessage) => void;
  addManagerChatMessage: (userId: string, message: ChatMessage) => void;
  saveShortcut: (userId: string, question: string) => void;
  savePolicyAnswer: (
    userId: string,
    entry: Omit<SavedPolicyAnswer, "id" | "savedAt">
  ) => void;
  removePolicyAnswer: (userId: string, answerId: string) => void;
  mergePlatformData: (patch: {
    lessons?: Lesson[];
    assignments?: LessonAssignment[];
    uploadedMaterials?: AppState["uploadedMaterials"];
    users?: User[];
  }) => void;
  addStaff: (staff: User) => void;
  removeStaff: (userId: string) => void;
  updateStaffPriorities: (userId: string, priorityCategories: string[]) => void;
  setCompetencyData: (patch: {
    domains?: CompetencyDomain[];
    records?: CompetencyRecord[];
    domainAssignments?: DomainAssignment[];
  }) => void;
  updateOrganization: (org: Organization) => void;
  mergeUserXp: (xp: UserXP) => void;
  mergeAssessmentEvent: (event: AssessmentEvent) => void;

  // Used by Learn page to trigger the Ask Policy sheet with context
  askWithQuestion: (question: string) => void;

  logIncident: (input: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: string;
    occurredAt: string;
  }) => Incident;
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function updateStreak(streaks: Streak[], userId: string): Streak[] {
  const today = todayISO();
  const existing = streaks.find((s) => s.userId === userId);

  if (!existing) {
    return [
      ...streaks,
      { userId, currentStreak: 1, longestStreak: 1, lastActivityDate: today },
    ];
  }

  if (existing.lastActivityDate === today) return streaks;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const continued = existing.lastActivityDate === yesterdayStr;
  const currentStreak = continued ? existing.currentStreak + 1 : 1;

  return streaks.map((s) =>
    s.userId === userId
      ? {
          ...s,
          currentStreak,
          longestStreak: Math.max(s.longestStreak, currentStreak),
          lastActivityDate: today,
        }
      : s
  );
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUserId: "user-snf-1",
      organizations: seedOrganizations,
      teams: seedTeams,
      users: seedUsers,
      lessons: seedLessons,
      assignments: seedAssignments,
      progress: initialProgress,
      streaks: initialStreaks,
      userXp: seedUsers
        .filter((u) => u.role === "staff")
        .map((u) => defaultUserXp(u.id)),
      incidents: initialIncidents,
      lessonRequests: [],
      documentChunks: [],
      uploadedMaterials: [],
      competencyDomains: [],
      competencyRecords: [],
      assessmentEvents: [],
      domainAssignments: [],
      pendingAskQuestion: null,
      chatMessages: {
        "user-snf-1": [
          { id: "seed-c1", role: "user", content: "What are the exact hand hygiene rules before every patient contact?", createdAt: "2026-06-11T10:12:00Z" },
          { id: "seed-c2", role: "user", content: "Do gloves replace hand hygiene in the SNF?", createdAt: "2026-06-11T10:14:00Z" },
        ],
        "user-bh-1": [
          { id: "seed-c3", role: "user", content: "What are early signs of patient escalation?", createdAt: "2026-06-11T11:03:00Z" },
          { id: "seed-c4", role: "user", content: "How far should I stand during de-escalation?", createdAt: "2026-06-10T14:22:00Z" },
        ],
        "user-hh-1": [
          { id: "seed-c5", role: "user", content: "When do I perform hand hygiene on a home visit?", createdAt: "2026-06-11T09:41:00Z" },
          { id: "seed-c6", role: "user", content: "What fall hazards should I check every visit?", createdAt: "2026-06-11T15:05:00Z" },
        ],
      },
      managerChatMessages: {},
      savedShortcuts: {},
      savedPolicyAnswers: {},
      hydrated: false,

      setCurrentUser: (userId) => {
        const currentUsers = get().users || [];
        if (currentUsers.length === 0) {
          set({ currentUserId: userId });
          return;
        }
        if (currentUsers.some((u) => u.id === userId)) {
          set({ currentUserId: userId });
          return;
        }
        const fallback =
          currentUsers.find((u) => u.role === "staff") ?? currentUsers[0];
        set({ currentUserId: fallback.id });
      },

      hydrateFromServer: async () => {
        try {
          const res = await fetch("/api/platform");
          if (!res.ok) return;
          const data = await res.json();
          const serverLessons = data.lessons ?? seedLessons;
          const currentLessons = get().lessons || [];
          // Preserve AI-generated / custom lessons across hydrate (so they don't reset on role switch or reload)
          const customLessons = currentLessons.filter((l: any) =>
            l.isAutoGenerated ||
            l.id?.startsWith('lesson-design-') ||
            l.id?.startsWith('lesson-ai-') ||
            l.id?.startsWith('lesson-custom-') ||
            l.id?.startsWith('lesson-refresher-') ||
            l.id?.startsWith('lesson-generated-')
          );
          const mergedLessons = [...serverLessons];
          customLessons.forEach((cl: any) => {
            if (!mergedLessons.some((sl: any) => sl.id === cl.id)) {
              mergedLessons.push(cl);
            }
          });
          set({
            organizations: data.organizations ?? seedOrganizations,
            teams: data.teams ?? seedTeams,
            users: data.users ?? seedUsers,
            lessons: mergedLessons,
            assignments: data.assignments ?? seedAssignments,
            progress: data.progress ?? initialProgress,
            streaks: data.streaks ?? initialStreaks,
            userXp: data.userXp ?? get().userXp,
            incidents: data.incidents ?? initialIncidents,
            lessonRequests: data.lessonRequests ?? [],
            documentChunks: data.documentChunks ?? [],
            uploadedMaterials: data.uploadedMaterials ?? [],
            competencyDomains: data.competencyDomains ?? [],
            competencyRecords: data.competencyRecords ?? [],
            assessmentEvents: data.assessmentEvents ?? [],
            domainAssignments: data.domainAssignments ?? [],
            hydrated: true,
          });
        } catch {
          set({ hydrated: true });
        }
      },

      syncToServer: (payload) => {
        fetch("/api/platform/progress", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).catch(() => {});
      },

      startLesson: (lessonId) => {
        const userId = get().currentUserId;
        const now = new Date().toISOString();
        const existing = get().progress.find(
          (p) => p.userId === userId && p.lessonId === lessonId
        );
        const newStreaks = updateStreak(get().streaks, userId);
        const streak = newStreaks.find((s) => s.userId === userId);

        if (existing) {
          const updated = get().progress.map((p) =>
            p.userId === userId && p.lessonId === lessonId
              ? { ...p, status: "in_progress" as const, lastAccessedAt: now }
              : p
          );
          set({ progress: updated, streaks: newStreaks });
          get().syncToServer({
            progress: updated.find(
              (p) => p.userId === userId && p.lessonId === lessonId
            ),
            streak,
          });
          return;
        }

        const newProgress: LessonProgress = {
          userId,
          lessonId,
          status: "in_progress",
          currentSlideIndex: 0,
          lastAccessedAt: now,
        };
        set({
          progress: [...get().progress, newProgress],
          streaks: newStreaks,
        });
        get().syncToServer({ progress: newProgress, streak });
      },

      advanceSlide: (lessonId) => {
        const userId = get().currentUserId;
        const lesson = get().lessons.find((l) => l.id === lessonId);
        if (!lesson) return;

        const updated = get().progress.map((p) => {
          if (p.userId !== userId || p.lessonId !== lessonId) return p;
          const nextIndex = Math.min(
            p.currentSlideIndex + 1,
            lesson.slides.length
          );
          return {
            ...p,
            currentSlideIndex: nextIndex,
            status: "in_progress" as const,
            lastAccessedAt: new Date().toISOString(),
          };
        });
        const newStreaks = updateStreak(get().streaks, userId);
        set({ progress: updated, streaks: newStreaks });
        get().syncToServer({
          progress: updated.find(
            (p) => p.userId === userId && p.lessonId === lessonId
          ),
          streak: newStreaks.find((s) => s.userId === userId),
        });
      },

      completeQuiz: (lessonId, score) => {
        const userId = get().currentUserId;
        const now = new Date().toISOString();
        const lesson = get().lessons.find((l) => l.id === lessonId);
        const baseXp = lesson?.xpReward ?? 15;
        const bonus = score === 100 ? 10 : 0;
        const earned = baseXp + bonus;

        const existingXp =
          get().userXp.find((x) => x.userId === userId) ??
          defaultUserXp(userId);
        const newXp = awardXp(existingXp, earned, todayISO());
        const newStreaks = updateStreak(get().streaks, userId);

        const updated = get().progress.map((p) =>
          p.userId === userId && p.lessonId === lessonId
            ? {
                ...p,
                status: "completed" as const,
                quizScore: score,
                completedAt: now.split("T")[0],
                lastAccessedAt: now,
                xpEarned: earned,
              }
            : p
        );

        const newUserXp = get().userXp.some((x) => x.userId === userId)
          ? get().userXp.map((x) => (x.userId === userId ? newXp : x))
          : [...get().userXp, newXp];

        set({
          progress: updated,
          streaks: newStreaks,
          userXp: newUserXp,
        });

        get().syncToServer({
          progress: updated.find(
            (p) => p.userId === userId && p.lessonId === lessonId
          ),
          streak: newStreaks.find((s) => s.userId === userId),
          userXp: newXp,
        });
      },

      addChatMessage: (userId, message) => {
        const existing = get().chatMessages[userId] ?? [];
        set({
          chatMessages: {
            ...get().chatMessages,
            [userId]: [...existing, message],
          },
        });
      },

      addManagerChatMessage: (userId, message) => {
        const existing = get().managerChatMessages[userId] ?? [];
        set({
          managerChatMessages: {
            ...get().managerChatMessages,
            [userId]: [...existing, message],
          },
        });
      },

      saveShortcut: (userId, question) => {
        const current = get().savedShortcuts || {};
        const existing = current[userId] ?? [];
        if (existing.includes(question)) return;
        set({
          savedShortcuts: {
            ...current,
            [userId]: [...existing, question].slice(-8), // keep last 8
          },
        });
      },

      savePolicyAnswer: (userId, entry) => {
        const current = get().savedPolicyAnswers || {};
        const existing = current[userId] ?? [];
        const duplicate = existing.some(
          (s) => s.question === entry.question && s.answer === entry.answer
        );
        if (duplicate) return;
        const saved: SavedPolicyAnswer = {
          ...entry,
          id: `saved-${Date.now()}`,
          savedAt: new Date().toISOString(),
        };
        set({
          savedPolicyAnswers: {
            ...current,
            [userId]: [saved, ...existing].slice(0, 30),
          },
        });
      },

      removePolicyAnswer: (userId, answerId) => {
        const current = get().savedPolicyAnswers || {};
        set({
          savedPolicyAnswers: {
            ...current,
            [userId]: (current[userId] ?? []).filter((s) => s.id !== answerId),
          },
        });
      },

      mergePlatformData: (patch) => {
        const state = get();
        let lessons = state.lessons;
        let assignments = state.assignments;
        let uploadedMaterials = state.uploadedMaterials;
        let users = state.users;

        if (patch.lessons?.length) {
          const byId = new Map(lessons.map((l) => [l.id, l]));
          for (const lesson of patch.lessons) byId.set(lesson.id, lesson);
          lessons = [...byId.values()];
        }

        if (patch.assignments?.length) {
          const byId = new Map(assignments.map((a) => [a.id, a]));
          for (const a of patch.assignments) {
            const key = `${a.lessonId}:${a.userId}`;
            const existing = assignments.find(
              (x) => `${x.lessonId}:${x.userId}` === key
            );
            if (existing) byId.set(existing.id, a);
            else byId.set(a.id, a);
          }
          assignments = [...byId.values()];
        }

        if (patch.uploadedMaterials) {
          uploadedMaterials = patch.uploadedMaterials;
        }

        if (patch.users?.length) {
          const byId = new Map(users.map((u) => [u.id, u]));
          for (const u of patch.users) byId.set(u.id, u);
          users = [...byId.values()];
        }

        set({ lessons, assignments, uploadedMaterials, users });
      },

      addStaff: (staff) => {
        const currentUsers = get().users;
        if (!currentUsers.some((u) => u.id === staff.id)) {
          set({ users: [...currentUsers, staff] });
        }
      },

      removeStaff: (userId) => {
        set({ users: get().users.filter((u) => u.id !== userId) });
      },

      updateStaffPriorities: (userId, priorityCategories) => {
        set({
          users: get().users.map((u) =>
            u.id === userId ? { ...u, priorityCategories } : u
          ),
        });
      },

      setCompetencyData: (patch) => {
        set({
          competencyDomains: patch.domains ?? get().competencyDomains,
          competencyRecords: patch.records ?? get().competencyRecords,
          domainAssignments: patch.domainAssignments ?? get().domainAssignments,
        });
      },

      updateOrganization: (org) => {
        set({
          organizations: get().organizations.map((o) =>
            o.id === org.id ? { ...o, ...org } : o
          ),
        });
      },

      mergeUserXp: (xp) => {
        const existing = get().userXp.some((x) => x.userId === xp.userId);
        set({
          userXp: existing
            ? get().userXp.map((x) => (x.userId === xp.userId ? xp : x))
            : [...get().userXp, xp],
        });
      },

      mergeAssessmentEvent: (event) => {
        const existing = get().assessmentEvents.some((e) => e.id === event.id);
        if (existing) return;
        set({ assessmentEvents: [...get().assessmentEvents, event] });
      },

      askWithQuestion: (question) => {
        // The floating ask component will pick this up
        set({ pendingAskQuestion: question });
      },

      logIncident: (input) => {
        const user = get().users.find((u) => u.id === get().currentUserId)!;
        const incident: Incident = {
          id: `inc-${Date.now()}`,
          orgId: user.orgId,
          teamId: user.teamId,
          reportedBy: user.id,
          title: input.title,
          description: input.description,
          severity: input.severity,
          category: input.category,
          occurredAt: input.occurredAt,
          status: "open",
        };

        const newLesson = generateRefresherLesson(incident);
        incident.suggestedLessonId = newLesson.id;
        incident.status = "lesson_assigned";

        const staff = get().users.filter(
          (u) =>
            u.orgId === user.orgId &&
            u.teamId === user.teamId &&
            u.role === "staff"
        );
        const newAssignments: LessonAssignment[] = staff.map((s) => ({
          id: `asgn-${incident.id}-${s.id}`,
          lessonId: newLesson.id,
          userId: s.id,
          assignedAt: todayISO(),
          dueAt: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
        }));

        set({
          incidents: [incident, ...get().incidents],
          lessons: [...get().lessons, newLesson],
          assignments: [...get().assignments, ...newAssignments],
        });

        return incident;
      },
    }),
    {
      name: "competencyflow-v05",
      partialize: (state) => ({
        currentUserId: state.currentUserId,
        progress: state.progress,
        streaks: state.streaks,
        userXp: state.userXp,
        chatMessages: state.chatMessages,
        managerChatMessages: state.managerChatMessages,
        savedPolicyAnswers: state.savedPolicyAnswers,
        savedShortcuts: state.savedShortcuts,
      }),
    }
  )
);

export { seedUsers as users };
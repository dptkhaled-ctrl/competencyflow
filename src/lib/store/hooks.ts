"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store/app-store";
import type {
  ChatMessage,
  Lesson,
  LessonProgress,
  Organization,
  User,
  UserXP,
} from "@/lib/types";

export function useCurrentOrg(): Organization | undefined {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.users);
  const organizations = useAppStore((s) => s.organizations);

  return useMemo(() => {
    const user = users.find((u) => u.id === currentUserId);
    if (!user) return organizations[0];
    return organizations.find((o) => o.id === user.orgId);
  }, [currentUserId, users, organizations]);
}

export function useCurrentUser(): User {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.users);
  return useMemo(() => {
    if (currentUserId) {
      const match = users.find((u) => u.id === currentUserId);
      if (match) return match;
    }
    return (
      users[0] ?? {
        id: "",
        orgId: "",
        teamId: "",
        name: "",
        email: "",
        role: "staff" as const,
        avatarInitials: "?",
      }
    );
  }, [currentUserId, users]);
}

export function useUserLessons(): Lesson[] {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.users);
  const lessons = useAppStore((s) => s.lessons);
  const assignments = useAppStore((s) => s.assignments);

  return useMemo(() => {
    const user = users.find((u) => u.id === currentUserId);
    if (!user) return [];
    const assignedIds = assignments
      .filter((a) => a.userId === user.id)
      .map((a) => a.lessonId);
    return lessons
      .filter((l) => {
        if (l.orgId !== user.orgId || !assignedIds.includes(l.id)) return false;
        return true;
      })
      .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  }, [currentUserId, users, lessons, assignments]);
}

export function useOrgStaff(): User[] {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const users = useAppStore((s) => s.users);

  return useMemo(() => {
    const user = users.find((u) => u.id === currentUserId);
    if (!user) return [];
    return users.filter(
      (u) =>
        u.orgId === user.orgId &&
        u.teamId === user.teamId &&
        u.role === "staff"
    );
  }, [currentUserId, users]);
}

export function useLessonProgress(lessonId: string): LessonProgress | undefined {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const progress = useAppStore((s) => s.progress);

  return useMemo(
    () =>
      progress.find(
        (p) => p.userId === currentUserId && p.lessonId === lessonId
      ),
    [currentUserId, progress, lessonId]
  );
}

export function useChatMessages(): ChatMessage[] {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const chatMessages = useAppStore((s) => s.chatMessages);

  return useMemo(
    () => chatMessages[currentUserId] ?? [],
    [currentUserId, chatMessages]
  );
}

export function useSavedShortcuts(): string[] {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const savedShortcuts = useAppStore((s) => s.savedShortcuts);
  return useMemo(() => (savedShortcuts || {})[currentUserId] ?? [], [currentUserId, savedShortcuts]);
}

export function useSavedPolicyAnswers() {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const savedPolicyAnswers = useAppStore((s) => s.savedPolicyAnswers);
  return useMemo(
    () => (savedPolicyAnswers || {})[currentUserId] ?? [],
    [currentUserId, savedPolicyAnswers]
  );
}

export function useRoleLabels() {
  return {
    staffLabel: "staff",
    managerLabel: "manager",
    staffTitle: "Staff",
    managerTitle: "Managers",
    dashboardTitle: "Your training dashboard",
    lessonsTitle: "Your lessons",
  };
}

export function useManagerChatMessages(): ChatMessage[] {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const managerChatMessages = useAppStore((s) => s.managerChatMessages);

  return useMemo(
    () => managerChatMessages[currentUserId] ?? [],
    [currentUserId, managerChatMessages]
  );
}

export function useUserXp(): UserXP {
  const currentUserId = useAppStore((s) => s.currentUserId);
  const userXp = useAppStore((s) => s.userXp);

  return useMemo(() => {
    return (
      userXp.find((x) => x.userId === currentUserId) ?? {
        userId: currentUserId,
        totalXp: 0,
        level: 1,
        dailyXp: 0,
        dailyGoal: 50,
        lastXpDate: new Date().toISOString().split("T")[0],
      }
    );
  }, [currentUserId, userXp]);
}
import type { UserXP } from "@/lib/types";

export function xpForLevel(level: number): number {
  return level * 100;
}

export function levelFromXp(totalXp: number): number {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level++;
  }
  return level;
}

export function xpProgressInLevel(totalXp: number): {
  level: number;
  current: number;
  needed: number;
  percent: number;
} {
  const level = levelFromXp(totalXp);
  let spent = 0;
  for (let l = 1; l < level; l++) spent += xpForLevel(l);
  const current = totalXp - spent;
  const needed = xpForLevel(level);
  return {
    level,
    current,
    needed,
    percent: Math.round((current / needed) * 100),
  };
}

export function awardXp(
  record: UserXP,
  amount: number,
  today: string
): UserXP {
  const dailyXp = record.lastXpDate === today ? record.dailyXp + amount : amount;
  const totalXp = record.totalXp + amount;
  return {
    ...record,
    totalXp,
    level: levelFromXp(totalXp),
    dailyXp,
    lastXpDate: today,
  };
}

export function defaultUserXp(userId: string): UserXP {
  return {
    userId,
    totalXp: 0,
    level: 1,
    dailyXp: 0,
    dailyGoal: 50,
    lastXpDate: new Date().toISOString().split("T")[0],
  };
}
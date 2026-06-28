import type {
  AssessmentEvent,
  CompetencyDomain,
  CompetencyRecord,
  DomainCoverage,
  User,
} from "@/lib/types";

export function getOrCreateRecord(
  records: CompetencyRecord[],
  userId: string,
  domainId: string
): CompetencyRecord {
  const existing = records.find(
    (r) => r.userId === userId && r.domainId === domainId
  );
  if (existing) return existing;
  return {
    userId,
    domainId,
    masteryPercent: 0,
    assessmentCount: 0,
    correctCount: 0,
  };
}

export function updateMasteryFromAssessment(
  record: CompetencyRecord,
  correct: boolean
): CompetencyRecord {
  const assessmentCount = record.assessmentCount + 1;
  const correctCount = record.correctCount + (correct ? 1 : 0);
  const accuracy = Math.round((correctCount / assessmentCount) * 100);
  const masteryPercent = Math.min(
    100,
    Math.round(record.masteryPercent * 0.6 + accuracy * 0.4)
  );

  return {
    ...record,
    assessmentCount,
    correctCount,
    masteryPercent,
    lastAssessedAt: new Date().toISOString(),
    gapNotes: masteryPercent < 60 ? "Needs review" : undefined,
  };
}

export function getWeakestDomain(
  records: CompetencyRecord[],
  domains: CompetencyDomain[],
  userId: string,
  orgId: string
): CompetencyDomain | null {
  const orgDomains = domains.filter((d) => d.orgId === orgId);
  if (orgDomains.length === 0) return null;

  let weakest: CompetencyDomain | null = null;
  let lowest = 101;

  for (const domain of orgDomains) {
    const record = records.find(
      (r) => r.userId === userId && r.domainId === domain.id
    );
    const score = record?.masteryPercent ?? 0;
    if (score < lowest) {
      lowest = score;
      weakest = domain;
    }
  }

  return weakest;
}

export function getUserAvgMastery(
  records: CompetencyRecord[],
  domains: CompetencyDomain[],
  userId: string,
  orgId: string
): number {
  const orgDomains = domains.filter((d) => d.orgId === orgId);
  if (orgDomains.length === 0) return 0;

  const total = orgDomains.reduce((sum, d) => {
    const r = records.find(
      (rec) => rec.userId === userId && rec.domainId === d.id
    );
    return sum + (r?.masteryPercent ?? 0);
  }, 0);

  return Math.round(total / orgDomains.length);
}

export function buildDomainCoverage(
  staff: User[],
  domains: CompetencyDomain[],
  records: CompetencyRecord[],
  orgId: string
): DomainCoverage[] {
  const orgDomains = domains.filter((d) => d.orgId === orgId);
  const orgStaff = staff.filter((u) => u.orgId === orgId && u.role === "staff");

  return orgDomains.map((domain) => {
    const staffRecords = orgStaff.map((u) =>
      records.find((r) => r.userId === u.id && r.domainId === domain.id)
    );
    const assessed = staffRecords.filter((r) => r && r.assessmentCount > 0);
    const avgMastery =
      assessed.length > 0
        ? Math.round(
            assessed.reduce((s, r) => s + (r?.masteryPercent ?? 0), 0) /
              assessed.length
          )
        : 0;

    return {
      domainId: domain.id,
      domainName: domain.name,
      staffAssessed: assessed.length,
      totalStaff: orgStaff.length,
      avgMastery,
      coveragePercent:
        orgStaff.length > 0
          ? Math.round((assessed.length / orgStaff.length) * 100)
          : 0,
    };
  });
}

export function getCompetencyGaps(
  records: CompetencyRecord[],
  domains: CompetencyDomain[],
  userId: string,
  orgId: string,
  threshold = 60
): Array<{ domainId: string; domainName: string; masteryPercent: number }> {
  return domains
    .filter((d) => d.orgId === orgId)
    .map((d) => {
      const r = records.find(
        (rec) => rec.userId === userId && rec.domainId === d.id
      );
      return {
        domainId: d.id,
        domainName: d.name,
        masteryPercent: r?.masteryPercent ?? 0,
      };
    })
    .filter((g) => g.masteryPercent < threshold)
    .sort((a, b) => a.masteryPercent - b.masteryPercent);
}

export function countRecentTutorMessages(
  events: AssessmentEvent[],
  userId: string,
  sinceMs: number
): number {
  const since = Date.now() - sinceMs;
  return events.filter(
    (e) => e.userId === userId && new Date(e.createdAt).getTime() >= since
  ).length;
}
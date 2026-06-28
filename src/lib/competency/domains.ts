import type { CompetencyDomain, Organization, OrgType, User } from "@/lib/types";

/** Rotation is on unless the org explicitly turns it off. */
export function isRefresherRotationEnabled(org?: Organization | null): boolean {
  return org?.refresherRotationEnabled !== false;
}

export const DEFAULT_REFRESHER_INTERVAL_DAYS = 90;

export const REFRESHER_INTERVAL_OPTIONS = [
  { value: 7, label: "Weekly (7 days)" },
  { value: 14, label: "Bi-weekly (14 days)" },
  { value: 30, label: "Monthly (30 days)" },
  { value: 60, label: "Bi-monthly (60 days)" },
  { value: 90, label: "Quarterly (90 days)" },
] as const;

export function getRefresherIntervalDays(
  category: string,
  options: {
    user?: Pick<User, "refresherIntervals" | "refresherIntervalDays">;
    domains?: CompetencyDomain[];
    orgId?: string;
  }
): number {
  const { user, domains, orgId } = options;
  if (user?.refresherIntervals?.[category] != null) {
    return user.refresherIntervals[category];
  }
  const domain = domains?.find(
    (d) =>
      d.orgId === orgId &&
      (d.name === category || d.slug === slugify(category))
  );
  if (domain?.refresherIntervalDays != null) {
    return domain.refresherIntervalDays;
  }
  return user?.refresherIntervalDays ?? DEFAULT_REFRESHER_INTERVAL_DAYS;
}

const SNF_CATEGORIES = [
  "Infection Prevention & Control",
  "Fall Prevention & Post-Fall Management",
  "Pressure Injury Prevention",
  "Abuse, Neglect & Exploitation",
  "Restraints & Alternatives",
  "Dementia Care & Behavioral Symptoms",
  "Medication Management",
  "Documentation & Medical Records",
  "Emergency Preparedness",
  "QAPI & Incident Reporting",
];

const BEHAVIORAL_HEALTH_CATEGORIES = [
  "De-escalation & Crisis Intervention",
  "Suicide Risk Assessment & Prevention",
  "Restraint & Seclusion",
  "Abuse & Neglect Reporting",
  "Trauma-Informed Care",
  "Medication Management (Psychotropic)",
  "Rights, Dignity and Advocacy",
  "Documentation of Behavioral Incidents",
  "Emergency Preparedness",
  "Infection Control in Behavioral Health",
];

const HOME_HEALTH_CATEGORIES = [
  "Infection Control in the Home",
  "Fall Prevention in the Home",
  "Medication Management & Reconciliation",
  "Wound Care Basics",
  "Abuse & Neglect Identification",
  "Documentation Standards for Home Visits",
  "Emergency Preparedness in the Home",
  "Confidentiality and Information Security",
  "Cultural Competency in Care Settings",
];

export function defaultDomainsForOrg(
  orgId: string,
  orgType: OrgType = "snf"
): CompetencyDomain[] {
  let names: string[];
  if (orgType === "behavioral_health") {
    names = BEHAVIORAL_HEALTH_CATEGORIES;
  } else if (orgType === "home_health") {
    names = HOME_HEALTH_CATEGORIES;
  } else {
    names = SNF_CATEGORIES;
  }
  return names.map((name) => ({
    id: `domain-${orgId}-${slugify(name)}`,
    orgId,
    name,
    slug: slugify(name),
    sourceDocumentIds: [],
    refresherIntervalDays: DEFAULT_REFRESHER_INTERVAL_DAYS,
  }));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function mapCategoryToDomainId(
  orgId: string,
  category: string,
  domains: CompetencyDomain[]
): string | undefined {
  const slug = slugify(category);
  const match = domains.find((d) => d.orgId === orgId && d.slug === slug);
  if (match) return match.id;

  const fuzzy = domains.find(
    (d) =>
      d.orgId === orgId &&
      (d.name.toLowerCase().includes(category.toLowerCase()) ||
        category.toLowerCase().includes(d.name.toLowerCase()))
  );
  return fuzzy?.id ?? domains.find((d) => d.orgId === orgId)?.id;
}

export function mergeExtractedDomains(
  orgId: string,
  extracted: Array<{ name: string; description?: string }>,
  existing: CompetencyDomain[],
  documentId: string
): CompetencyDomain[] {
  const bySlug = new Map(existing.filter((d) => d.orgId === orgId).map((d) => [d.slug, d]));
  const result = [...existing];

  for (const item of extracted) {
    const slug = slugify(item.name);
    const found = bySlug.get(slug);
    if (found) {
      if (!found.sourceDocumentIds.includes(documentId)) {
        found.sourceDocumentIds.push(documentId);
      }
      continue;
    }
    const domain: CompetencyDomain = {
      id: `domain-${orgId}-${slug}-${Date.now().toString(36)}`,
      orgId,
      name: item.name,
      slug,
      description: item.description,
      sourceDocumentIds: [documentId],
    };
    result.push(domain);
    bySlug.set(slug, domain);
  }

  return result;
}

const ROLE_CATEGORY_MAP: Record<OrgType, Record<string, string[]>> = {
  snf: {
    "CNA / Nursing Assistant": ["Infection Prevention & Control", "Fall Prevention & Post-Fall Management", "Abuse, Neglect & Exploitation", "Dementia Care & Behavioral Symptoms"],
    "LVN / LPN": ["Infection Prevention & Control", "Medication Management", "Fall Prevention & Post-Fall Management", "Documentation & Medical Records", "Abuse, Neglect & Exploitation"],
    "RN / Charge Nurse": [], // all - special case
    "Physical / Occupational Therapist": ["Fall Prevention & Post-Fall Management", "Documentation & Medical Records", "Infection Prevention & Control"],
    "Social Worker": ["Abuse, Neglect & Exploitation", "Documentation & Medical Records", "Rights, Dignity and Advocacy"],
    "Housekeeping / Environmental Services": ["Infection Prevention & Control", "Emergency Preparedness"],
    "Dietary Aide / Cook": ["Infection Prevention & Control", "Emergency Preparedness"],
    "Administrator / DON": [], // all
  },
  behavioral_health: {
    "Mental Health Worker (MHW)": ["De-escalation & Crisis Intervention", "Abuse & Neglect Reporting", "Rights, Dignity and Advocacy", "Emergency Preparedness"],
    "Psychiatric Nurse (RN/LVN)": ["De-escalation & Crisis Intervention", "Medication Management (Psychotropic)", "Restraint & Seclusion", "Documentation of Behavioral Incidents", "Suicide Risk Assessment & Prevention"],
    "Therapist / Clinician": ["Suicide Risk Assessment & Prevention", "Trauma-Informed Care", "Documentation of Behavioral Incidents", "Abuse & Neglect Reporting"],
    "Case Manager / Social Worker": ["Abuse & Neglect Reporting", "Rights, Dignity and Advocacy", "Documentation of Behavioral Incidents"],
    "Activities Coordinator": ["De-escalation & Crisis Intervention", "Abuse & Neglect Reporting", "Emergency Preparedness"],
    "Administrator": [],
  },
  home_health: {
    "Home Health Aide (HHA)": ["Infection Control in the Home", "Fall Prevention in the Home", "Abuse & Neglect Identification", "Emergency Preparedness in the Home"],
    "LVN / LPN": ["Infection Control in the Home", "Medication Management & Reconciliation", "Wound Care Basics", "Documentation Standards for Home Visits", "Fall Prevention in the Home"],
    "RN / Case Manager": [],
    "Physical / Occupational Therapist": ["Fall Prevention in the Home", "Documentation Standards for Home Visits", "Infection Control in the Home"],
    "Medical Social Worker": ["Abuse & Neglect Identification", "Documentation Standards for Home Visits", "Emergency Preparedness in the Home", "Cultural Competency in Patient Homes"],
    "Administrator": [],
  },
};

export function getDefaultPrioritiesForRole(orgType: OrgType, jobTitle: string, allCategories: string[]): string[] {
  const map = ROLE_CATEGORY_MAP[orgType] || {};
  const cores = map[jobTitle] || [];
  if (cores.length === 0) {
    // "All categories" roles
    return [...allCategories];
  }
  // Filter to only those that exist for the org
  return cores.filter(c => allCategories.includes(c));
}

export function getJobTitlesForOrgType(orgType: OrgType): string[] {
  const map = ROLE_CATEGORY_MAP[orgType] || {};
  return Object.keys(map);
}

export function getCategoriesForOrgType(orgType: OrgType): string[] {
  if (orgType === "behavioral_health") {
    return [...BEHAVIORAL_HEALTH_CATEGORIES];
  }
  if (orgType === "home_health") {
    return [...HOME_HEALTH_CATEGORIES];
  }
  return [...SNF_CATEGORIES];
}
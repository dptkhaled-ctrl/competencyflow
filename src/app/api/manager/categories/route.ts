import { NextResponse } from "next/server";
import { readPlatform, updateCompetencyDomain } from "@/lib/server/data-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const platform = await readPlatform();
  const domains = platform.competencyDomains.filter((d) => d.orgId === orgId);
  const lessons = platform.lessons.filter((l) => l.orgId === orgId);

  const categories = domains.map((domain) => ({
    ...domain,
    lessonCount: lessons.filter((l) => l.category === domain.name).length,
  }));

  return NextResponse.json({ categories, lessons });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const { domainId, refresherIntervalDays } = body as {
    domainId?: string;
    refresherIntervalDays?: number;
  };

  if (!domainId || refresherIntervalDays == null) {
    return NextResponse.json(
      { error: "domainId and refresherIntervalDays required" },
      { status: 400 }
    );
  }

  const interval = Number(refresherIntervalDays);
  if (!Number.isFinite(interval) || interval < 1 || interval > 365) {
    return NextResponse.json(
      { error: "refresherIntervalDays must be between 1 and 365" },
      { status: 400 }
    );
  }

  const domain = await updateCompetencyDomain(domainId, { refresherIntervalDays: interval });
  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  return NextResponse.json({ domain });
}
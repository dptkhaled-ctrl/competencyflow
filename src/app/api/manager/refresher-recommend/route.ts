import { NextResponse } from "next/server";
import { recommendRefreshers } from "@/lib/ai/refresher-recommender";
import { readPlatform } from "@/lib/server/data-store";
import type { OrgType } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, orgType, orgName, incident } = body as {
      orgId?: string;
      orgType?: OrgType;
      orgName?: string;
      incident?: string;
    };

    if (!orgId || !incident?.trim()) {
      return NextResponse.json(
        { error: "orgId and incident are required" },
        { status: 400 }
      );
    }

    const platform = await readPlatform();
    const org = platform.organizations.find((o) => o.id === orgId);
    const lessons = platform.lessons
      .filter((l) => l.orgId === orgId)
      .map((l) => ({
        id: l.id,
        title: l.title,
        category: l.category,
        isRefresher: l.isRefresher,
      }));

    const result = await recommendRefreshers({
      incident: incident.trim(),
      orgId,
      orgType: orgType ?? org?.orgType ?? "snf",
      orgName: orgName ?? org?.name ?? "your organization",
      lessons,
      documentChunks: platform.documentChunks,
    });

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Recommendation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
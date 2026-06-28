import { NextResponse } from "next/server";
import { createOrganization, readPlatform } from "@/lib/server/data-store";
import type { OrgType } from "@/lib/types";

export async function GET() {
  const data = await readPlatform();
  return NextResponse.json({
    organizations: data.organizations,
    teams: data.teams,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, industry, orgType, teamName } = body as {
      name?: string;
      industry?: string;
      orgType?: OrgType;
      teamName?: string;
    };

    if (!name?.trim() || !industry?.trim()) {
      return NextResponse.json(
        { error: "Name and industry are required" },
        { status: 400 }
      );
    }

    const result = await createOrganization({
      name,
      industry,
      orgType: orgType ?? "snf",
      teamName,
    });

    const data = await readPlatform();
    const saved = data.organizations.some((o) => o.id === result.org.id);
    if (!saved) {
      return NextResponse.json(
        { error: "Organization could not be saved. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[admin/organizations POST]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to create organization. Please try again.",
      },
      { status: 500 }
    );
  }
}
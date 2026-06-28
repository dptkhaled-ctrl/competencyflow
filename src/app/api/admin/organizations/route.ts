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

  return NextResponse.json(result, { status: 201 });
}
import { NextResponse } from "next/server";
import { createTeam } from "@/lib/server/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  const { orgId, name } = body as { orgId?: string; name?: string };

  if (!orgId || !name?.trim()) {
    return NextResponse.json(
      { error: "orgId and name are required" },
      { status: 400 }
    );
  }

  const team = await createTeam(orgId, name);

  if (!team) {
    return NextResponse.json({ error: "Organization not found" }, { status: 400 });
  }

  return NextResponse.json({ team }, { status: 201 });
}
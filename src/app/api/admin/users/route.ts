import { NextResponse } from "next/server";
import { createUser } from "@/lib/server/data-store";
import type { UserRole } from "@/lib/types";

export async function POST(request: Request) {
  const body = await request.json();
  const { orgId, teamId, name, email, role, jobTitle, priorityCategories } = body as {
    orgId?: string;
    teamId?: string;
    name?: string;
    email?: string;
    role?: UserRole;
    jobTitle?: string;
    priorityCategories?: string[];
  };

  if (!orgId || !teamId || !name?.trim() || !email?.trim() || !role) {
    return NextResponse.json(
      { error: "orgId, teamId, name, email, and role are required" },
      { status: 400 }
    );
  }

  if (role !== "staff" && role !== "manager") {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const user = await createUser({ orgId, teamId, name, email, role, jobTitle, priorityCategories });

  if (!user) {
    return NextResponse.json(
      { error: "Invalid organization or team" },
      { status: 400 }
    );
  }

  return NextResponse.json({ user }, { status: 201 });
}
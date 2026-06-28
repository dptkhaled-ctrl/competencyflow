import { NextResponse } from "next/server";
import { deleteUser, updateUser } from "@/lib/server/data-store";
import type { UserRole } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, email, role, orgId, teamId, jobTitle, priorityCategories } = body as {
    name?: string;
    email?: string;
    role?: UserRole;
    orgId?: string;
    teamId?: string;
    jobTitle?: string;
    priorityCategories?: string[];
  };

  const user = await updateUser(id, { name, email, role, orgId, teamId, jobTitle, priorityCategories });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteUser(id);
  return NextResponse.json({ ok: true });
}
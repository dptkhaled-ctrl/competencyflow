import { NextResponse } from "next/server";
import {
  createStaffUser,
  deleteStaffUser,
  updateUser,
  updateUserPriorities,
  readPlatform,
} from "@/lib/server/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  const { action, ...data } = body;

  if (action === "add") {
    // data may contain jobTitle and priorityCategories for role-based assignment
    const user = await createStaffUser(data);
    return NextResponse.json({ user }, { status: user ? 201 : 400 });
  }

  if (action === "updatePriorities") {
    const { userId, priorityCategories } = data;
    const user = await updateUserPriorities(userId, priorityCategories);
    return NextResponse.json({ user });
  }

  if (action === "updateRefresherInterval") {
    const { userId, refresherIntervalDays } = data;
    const user = await updateUser(userId, { refresherIntervalDays });
    return NextResponse.json({ user });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  const ok = await deleteStaffUser(userId);
  return NextResponse.json({ ok });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });

  const platform = await readPlatform();
  const users = platform.users.filter((u) => u.orgId === orgId && u.role === "staff");
  return NextResponse.json({ users });
}

import { NextResponse } from "next/server";
import { readPlatform, assignLessonsToUsers } from "@/lib/server/data-store";

export async function POST(request: Request) {
  try {
    const { orgId } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const platform = await readPlatform();
    const orgLessons = platform.lessons.filter((l) => l.orgId === orgId);
    const staffIds = platform.users
      .filter((u) => u.orgId === orgId && u.role === "staff")
      .map((u) => u.id);

    if (orgLessons.length === 0) {
      return NextResponse.json({ ok: true, assigned: 0, message: "No lessons to assign." });
    }
    if (staffIds.length === 0) {
      return NextResponse.json({ ok: true, assigned: 0, message: "No staff users in this organization yet." });
    }

    await assignLessonsToUsers(
      orgLessons.map((l) => l.id),
      staffIds
    );

    return NextResponse.json({
      ok: true,
      assigned: orgLessons.length,
      staffCount: staffIds.length,
      message: `Assigned ${orgLessons.length} lessons to ${staffIds.length} staff members.`,
    });
  } catch (err: any) {
    console.error("Assign all lessons error:", err);
    return NextResponse.json({ error: "Failed to assign lessons" }, { status: 500 });
  }
}

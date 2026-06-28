import { NextResponse } from "next/server";
import { readPlatform, removeLesson, updateLesson } from "@/lib/server/data-store";
import type { Lesson } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    const updates = (await request.json()) as Partial<Lesson>;

    const updated = await updateLesson(lessonId, updates);
    if (!updated) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, lesson: updated });
  } catch (err: any) {
    console.error("Update lesson error:", err);
    return NextResponse.json({ error: "Failed to update lesson" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: lessonId } = await params;
    const ok = await removeLesson(lessonId);
    if (!ok) {
      return NextResponse.json({ error: "Lesson not found or could not be removed" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("Delete lesson error:", err);
    return NextResponse.json({ error: "Failed to delete lesson" }, { status: 500 });
  }
}

// Optional GET for a single lesson if needed by admin UI
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: lessonId } = await params;
  const platform = await readPlatform();
  const lesson = platform.lessons.find((l) => l.id === lessonId);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ lesson });
}

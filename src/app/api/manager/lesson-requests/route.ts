import { NextResponse } from "next/server";
import { createLessonRequest, getLessonRequests } from "@/lib/server/data-store";
import type { LessonRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, requestedBy, title, description, type = 'refresher', source = 'pain_point', suggestedLesson } = body as {
      orgId?: string;
      requestedBy?: string;
      title?: string;
      description?: string;
      type?: LessonRequest['type'];
      source?: LessonRequest['source'];
      suggestedLesson?: LessonRequest['suggestedLesson'];
    };

    if (!orgId || !requestedBy || !title || !description) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const req = await createLessonRequest({
      orgId,
      requestedBy,
      title,
      description,
      type,
      source,
      suggestedLesson,
    });

    return NextResponse.json({ request: req });
  } catch (err: any) {
    console.error("Create lesson request error:", err);
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  const requests = await getLessonRequests(orgId);
  return NextResponse.json({ requests });
}

import { NextResponse } from "next/server";
import { generateAIChatResponse } from "@/lib/ai/chat-generator";
import { readPlatform } from "@/lib/server/data-store";

export async function POST(request: Request) {
  const body = await request.json();
  const { orgId, question } = body as { orgId?: string; question?: string };

  if (!orgId || !question?.trim()) {
    return NextResponse.json(
      { error: "orgId and question are required" },
      { status: 400 }
    );
  }

  const platform = await readPlatform();
  const org = platform.organizations.find((o) => o.id === orgId);
  const orgChunks = platform.documentChunks.filter((c) => c.orgId === orgId);

  const response = await generateAIChatResponse({
    orgId,
    orgName: org?.name ?? "Your organization",
    question: question.trim(),
    chunks: orgChunks,
  });

  return NextResponse.json(response);
}
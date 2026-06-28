import { NextResponse } from "next/server";
import { analyzePainPoints } from "@/lib/ai/pain-point-analyzer";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { orgId, questions, orgName } = body as {
      orgId?: string;
      questions?: string[];
      orgName?: string;
    };

    if (!questions || questions.length === 0) {
      return NextResponse.json({ painPoints: [] });
    }

    const painPoints = await analyzePainPoints(questions, orgName || "your organization");
    return NextResponse.json({ painPoints });
  } catch (err: any) {
    return NextResponse.json(
      { painPoints: [], error: "Analysis failed" },
      { status: 200 } // still return graceful empty so UI doesn't break
    );
  }
}

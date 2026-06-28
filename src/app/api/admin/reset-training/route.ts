import { NextResponse } from "next/server";
import { resetOrgToLatestUpload } from "@/lib/server/data-store";

export async function POST(request: Request) {
  const { orgId } = (await request.json()) as { orgId?: string };

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const ok = await resetOrgToLatestUpload(orgId);
  if (!ok) {
    return NextResponse.json(
      { error: "No successful uploads found for this organization" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Training reset — staff now see only the latest upload's lessons.",
  });
}
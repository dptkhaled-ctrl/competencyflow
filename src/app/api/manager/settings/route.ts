import { NextResponse } from "next/server";
import { updateOrganization } from "@/lib/server/data-store";

export async function PATCH(request: Request) {
  const body = await request.json();
  const { orgId, refresherRotationEnabled } = body as {
    orgId?: string;
    refresherRotationEnabled?: boolean;
  };

  if (!orgId || typeof refresherRotationEnabled !== "boolean") {
    return NextResponse.json(
      { error: "orgId and refresherRotationEnabled (boolean) required" },
      { status: 400 }
    );
  }

  const org = await updateOrganization(orgId, { refresherRotationEnabled });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ organization: org });
}
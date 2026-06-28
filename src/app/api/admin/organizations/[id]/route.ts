import { NextResponse } from "next/server";
import {
  deleteOrganization,
  getOrgDetail,
  readPlatform,
  updateOrganization,
} from "@/lib/server/data-store";
import type { OrgType } from "@/lib/types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const data = await readPlatform();
  const detail = getOrgDetail(data, id);

  if (!detail) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const { name, industry, orgType } = body as {
    name?: string;
    industry?: string;
    orgType?: OrgType;
  };

  const org = await updateOrganization(id, {
    name,
    industry,
    orgType,
  });

  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  return NextResponse.json({ organization: org });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const result = await deleteOrganization(id);

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
import { NextResponse } from "next/server";
import { sendInviteEmail } from "@/lib/auth/mailer";
import { createInvite, listInvitesForOrg } from "@/lib/server/data-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const invites = await listInvitesForOrg(orgId, "manager");
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const orgId = String(body.orgId ?? "");
  const teamId = String(body.teamId ?? "");

  if (!email || !name || !orgId || !teamId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const invite = await createInvite({
    email,
    name,
    role: "manager",
    orgId,
    teamId,
    invitedByAdmin: true,
  });

  if (!invite) {
    return NextResponse.json({ error: "Could not create invite" }, { status: 400 });
  }

  const mail = await sendInviteEmail(invite);
  if (!mail.ok) {
    return NextResponse.json(
      { error: mail.error ?? "Failed to send email", invite },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, invite, emailSent: true });
}
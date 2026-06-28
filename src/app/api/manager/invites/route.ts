import { NextResponse } from "next/server";
import { getSessionPlatformUser } from "@/lib/auth/session";
import { sendInviteEmail } from "@/lib/auth/mailer";
import { createInvite, listInvitesForOrg } from "@/lib/server/data-store";
import { getDefaultPrioritiesForRole } from "@/lib/competency/domains";
import { readPlatform } from "@/lib/server/data-store";

export async function GET() {
  const manager = await getSessionPlatformUser();
  if (!manager || manager.role !== "manager") {
    return NextResponse.json({ error: "Manager access required" }, { status: 401 });
  }

  const invites = await listInvitesForOrg(manager.orgId, "staff");
  return NextResponse.json({ invites });
}

export async function POST(request: Request) {
  const manager = await getSessionPlatformUser();
  if (!manager || manager.role !== "manager") {
    return NextResponse.json({ error: "Manager access required" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const jobTitle = String(body.jobTitle ?? "").trim();

  if (!email || !name || !jobTitle) {
    return NextResponse.json({ error: "Name, email, and job title required" }, { status: 400 });
  }

  const platform = await readPlatform();
  const org = platform.organizations.find((o) => o.id === manager.orgId);
  const orgCategories = platform.competencyDomains
    .filter((d) => d.orgId === manager.orgId)
    .map((d) => d.name);
  const priorities = getDefaultPrioritiesForRole(
    org?.orgType || "snf",
    jobTitle,
    orgCategories
  );

  const invite = await createInvite({
    email,
    name,
    role: "staff",
    orgId: manager.orgId,
    teamId: manager.teamId,
    jobTitle,
    priorityCategories: priorities,
    invitedByUserId: manager.id,
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
import { NextResponse } from "next/server";
import { deliverInvite } from "@/lib/auth/invite-delivery";
import { createInvite, listInvitesForOrg, readPlatform } from "@/lib/server/data-store";
import { getInvitePageUrl } from "@/lib/auth/mailer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const invites = await listInvitesForOrg(orgId, "manager");
  const withLinks = invites.map((inv) => ({
    ...inv,
    inviteLink: getInvitePageUrl(inv.token),
  }));
  return NextResponse.json({ invites: withLinks });
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

  const platform = await readPlatform();
  const orgName = platform.organizations.find((o) => o.id === orgId)?.name;
  const result = await deliverInvite(invite, { orgName });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        invite: result.invite,
        inviteLink: result.inviteLink,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(result);
}
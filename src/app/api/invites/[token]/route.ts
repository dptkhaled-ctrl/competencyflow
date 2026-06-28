import { NextResponse } from "next/server";
import { getInviteByTokenForPage } from "@/lib/server/data-store";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await getInviteByTokenForPage(token);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }

  if (invite.alreadyAccepted) {
    return NextResponse.json({
      alreadyAccepted: true,
      email: invite.email,
      name: invite.name,
      role: invite.role,
      orgName: invite.orgName,
      teamName: invite.teamName,
    });
  }

  return NextResponse.json({
    email: invite.email,
    name: invite.name,
    role: invite.role,
    orgName: invite.orgName,
    teamName: invite.teamName,
    expiresAt: invite.expiresAt,
  });
}
import { NextResponse } from "next/server";
import { getInviteActivationConfirmUrl } from "@/lib/auth/mailer";
import { getInviteByToken } from "@/lib/server/data-store";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const invite = await getInviteByToken(token);

  if (!invite) {
    return NextResponse.json({ error: "Invite not found or expired" }, { status: 404 });
  }

  const redirectUrl = await getInviteActivationConfirmUrl(invite);
  if (!redirectUrl) {
    return NextResponse.json(
      { error: "Could not create activation link. Try again or contact your administrator." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, redirectUrl });
}
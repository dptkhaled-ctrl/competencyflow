import { NextResponse } from "next/server";
import { sendInviteEmail } from "@/lib/auth/mailer";
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

  const mail = await sendInviteEmail(invite);
  if (!mail.ok) {
    return NextResponse.json(
      { error: mail.error ?? "Could not send activation email" },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: "Activation email sent. Check your inbox and spam folder.",
  });
}
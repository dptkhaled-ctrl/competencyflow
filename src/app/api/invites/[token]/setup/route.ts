import { NextResponse } from "next/server";
import {
  ensureAuthUserWithPassword,
  validatePassword,
} from "@/lib/auth/invite-setup";
import { createClient } from "@/lib/supabase/server";
import { acceptInvite, getInviteByToken } from "@/lib/server/data-store";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const invite = await getInviteByToken(token);

    if (!invite) {
      return NextResponse.json(
        { error: "Invite not found or expired. Ask for a new invite." },
        { status: 404 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const password = String(body.password ?? "");
    const confirm = String(body.confirmPassword ?? "");

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    if (password !== confirm) {
      return NextResponse.json(
        { error: "Passwords do not match." },
        { status: 400 }
      );
    }

    const authUserId = await ensureAuthUserWithPassword({
      email: invite.email,
      password,
      name: invite.name,
      role: invite.role,
    });

    const platformUser = await acceptInvite(token, authUserId, invite.email);
    if (!platformUser) {
      return NextResponse.json(
        {
          error:
            "Account was created but setup did not finish. Try again or contact support.",
        },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: invite.email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        {
          error:
            "Account created. Go to Sign in and use your new password.",
          redirectTo: "/login",
        },
        { status: 502 }
      );
    }

    const redirectTo =
      platformUser.role === "manager" ? "/manager" : "/staff";

    return NextResponse.json({
      ok: true,
      redirectTo,
      message: "Welcome! Your account is ready.",
    });
  } catch (err) {
    console.error("[invites/setup]", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Could not complete setup. Please try again.",
      },
      { status: 500 }
    );
  }
}
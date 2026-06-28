import { NextResponse } from "next/server";
import { sendLoginMagicLink } from "@/lib/auth/mailer";
import { findUserByEmail } from "@/lib/server/data-store";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (!existing) {
      return NextResponse.json(
        {
          error:
            "No account found for this email. Ask your manager or administrator for an invite link.",
        },
        { status: 404 }
      );
    }

    const result = await sendLoginMagicLink(email);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error ?? "Could not send login link" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message: "Check your email for a secure sign-in link.",
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: "Server error while sending login link. Please try again." },
      { status: 500 }
    );
  }
}
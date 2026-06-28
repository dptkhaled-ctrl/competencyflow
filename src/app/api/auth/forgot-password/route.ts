import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/auth/urls";
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

    const platformUser = await findUserByEmail(email);
    if (!platformUser) {
      // Don't reveal whether email exists
      return NextResponse.json({
        ok: true,
        message:
          "If an account exists for this email, we sent password reset instructions.",
      });
    }

    const supabase = await createClient();
    const redirectTo = `${siteUrl()}/auth/callback?next=${encodeURIComponent("/auth/reset-password")}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      console.error("[auth/forgot-password]", error);
      return NextResponse.json(
        { error: "Could not send reset email. Try again in a few minutes." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      message:
        "Password reset email sent. Check your inbox and spam folder.",
    });
  } catch (err) {
    console.error("[auth/forgot-password]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
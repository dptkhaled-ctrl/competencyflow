import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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
    const password = String(body.password ?? "");

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    const existing = await findUserByEmail(email);
    if (!existing) {
      return NextResponse.json(
        {
          error:
            "No account found for this email. Use the invite link from your administrator to set up your account first.",
        },
        { status: 404 }
      );
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    const redirectTo = existing.role === "manager" ? "/manager" : "/staff";

    return NextResponse.json({
      ok: true,
      redirectTo,
      message: "Signed in successfully.",
    });
  } catch (err) {
    console.error("[auth/login]", err);
    return NextResponse.json(
      { error: "Server error while signing in. Please try again." },
      { status: 500 }
    );
  }
}
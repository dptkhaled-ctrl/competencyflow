import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  findUserByAuthUserId,
  findUserByEmail,
  linkAuthUser,
} from "@/lib/server/data-store";
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

    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return NextResponse.json(
        { error: "Incorrect email or password." },
        { status: 401 }
      );
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Sign-in failed." }, { status: 401 });
    }

    let platformUser = await findUserByAuthUserId(authUser.id);
    if (!platformUser) {
      platformUser = await findUserByEmail(email);
      if (platformUser) {
        platformUser = await linkAuthUser({
          authUserId: authUser.id,
          platformUserId: platformUser.id,
        });
      }
    }

    if (!platformUser && authUser.email) {
      platformUser = await findUserByEmail(authUser.email);
      if (platformUser) {
        platformUser = await linkAuthUser({
          authUserId: authUser.id,
          platformUserId: platformUser.id,
        });
      }
    }

    if (!platformUser) {
      return NextResponse.json(
        {
          error:
            "Signed in, but your profile is not set up. Open your invite link again or contact your administrator.",
        },
        { status: 404 }
      );
    }

    const redirectTo =
      platformUser.role === "manager" ? "/manager" : "/staff";

    return NextResponse.json({
      ok: true,
      redirectTo,
      userId: platformUser.id,
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
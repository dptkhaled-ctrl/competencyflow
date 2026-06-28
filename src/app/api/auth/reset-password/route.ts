import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/invite-setup";
import { getSessionPlatformUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Auth not configured" }, { status: 503 });
    }

    const authUser = await (async () => {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      return user;
    })();

    if (!authUser) {
      return NextResponse.json(
        { error: "Reset link expired. Request a new one from the sign-in page." },
        { status: 401 }
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
      return NextResponse.json({ error: "Passwords do not match." }, { status: 400 });
    }

    const supabase = await createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return NextResponse.json(
        { error: error.message || "Could not update password." },
        { status: 400 }
      );
    }

    const platformUser = await getSessionPlatformUser();
    const redirectTo =
      platformUser?.role === "manager" ? "/manager" : "/staff";

    return NextResponse.json({
      ok: true,
      redirectTo,
      message: "Password updated. You're signed in.",
    });
  } catch (err) {
    console.error("[auth/reset-password]", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
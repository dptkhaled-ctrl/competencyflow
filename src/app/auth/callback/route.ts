import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  acceptInvite,
  findUserByAuthUserId,
  findUserByEmail,
  linkAuthUser,
} from "@/lib/server/data-store";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite");
  const nextPath = searchParams.get("next");
  const authError = searchParams.get("error_description");

  if (authError) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(authError)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    if (nextPath && nextPath.startsWith("/")) {
      return NextResponse.redirect(`${origin}${nextPath}`);
    }

    if (inviteToken) {
      await acceptInvite(inviteToken, user.id, user.email ?? undefined);
    }

    let platformUser = await findUserByAuthUserId(user.id);
    if (!platformUser && user.email) {
      const byEmail = await findUserByEmail(user.email);
      if (byEmail) {
        platformUser = await linkAuthUser({
          authUserId: user.id,
          platformUserId: byEmail.id,
        });
      }
    }
    if (platformUser) {
      const dest = platformUser.role === "manager" ? "/manager" : "/staff";
      return NextResponse.redirect(`${origin}${dest}`);
    }

    if (inviteToken) {
      return NextResponse.redirect(`${origin}/invite/${inviteToken}?setup=1`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=setup_required`);
}
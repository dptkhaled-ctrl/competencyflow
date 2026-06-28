import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  acceptInvite,
  findUserByAuthUserId,
  findUserByEmail,
  linkAuthUser,
} from "@/lib/server/data-store";

type OtpType = "invite" | "magiclink" | "email" | "signup" | "recovery";

async function verifyTokenHash(
  supabase: Awaited<ReturnType<typeof createClient>>,
  token_hash: string,
  preferredType: string
) {
  const types = Array.from(
    new Set([preferredType, "invite", "magiclink", "email"])
  ) as OtpType[];

  for (const type of types) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    });
    if (!error) return null;
    if (type === preferredType) {
      return error;
    }
  }

  return new Error("Could not verify activation link");
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") || "invite";
  const inviteToken = searchParams.get("invite");

  if (!token_hash) {
    return NextResponse.redirect(`${origin}/login?error=missing_token`);
  }

  const supabase = await createClient();
  const verifyError = await verifyTokenHash(supabase, token_hash, type);

  if (verifyError) {
    const back = inviteToken
      ? `${origin}/invite/${inviteToken}?error=${encodeURIComponent(verifyError.message)}`
      : `${origin}/login?error=${encodeURIComponent(verifyError.message)}`;
    return NextResponse.redirect(back);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
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

  return NextResponse.redirect(`${origin}/login?error=setup_required`);
}
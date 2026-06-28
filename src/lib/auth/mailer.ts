import { createClient } from "@supabase/supabase-js";
import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import type { Invite } from "@/lib/types";

function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function inviteRedirectUrl(token: string) {
  return `${siteUrl()}/auth/callback?invite=${encodeURIComponent(token)}`;
}

export async function sendInviteEmail(invite: Invite): Promise<{
  ok: boolean;
  method: "invite" | "magiclink" | "otp";
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, method: "otp", error: "Supabase not configured" };
  }

  const redirectTo = inviteRedirectUrl(invite.token);

  if (hasServiceRoleKey()) {
    const admin = createAdminClient();
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
      invite.email,
      {
        redirectTo,
        data: {
          full_name: invite.name,
          role: invite.role,
          org_id: invite.orgId,
          invite_token: invite.token,
        },
      }
    );

    if (!inviteError) {
      return { ok: true, method: "invite" };
    }
  }

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: invite.email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: redirectTo,
      data: {
        full_name: invite.name,
        role: invite.role,
        org_id: invite.orgId,
        invite_token: invite.token,
      },
    },
  });

  if (otpError) {
    return { ok: false, method: "otp", error: otpError.message };
  }

  return { ok: true, method: "otp" };
}

export async function sendLoginMagicLink(email: string): Promise<{
  ok: boolean;
  error?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured" };
  }

  const normalized = email.trim().toLowerCase();
  const redirectTo = `${siteUrl()}/auth/callback`;

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());

  // Existing Supabase auth user
  let { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

  // Platform user not yet in Supabase auth — send magic link to create + link on callback
  if (
    error &&
    (error.code === "otp_disabled" ||
      error.message.toLowerCase().includes("signups not allowed"))
  ) {
    const retry = await supabase.auth.signInWithOtp({
      email: normalized,
      options: { shouldCreateUser: true, emailRedirectTo: redirectTo },
    });
    error = retry.error;
  }

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("rate limit")) {
      return {
        ok: false,
        error: "Too many emails sent. Wait a few minutes and try again.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
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

export function getInvitePageUrl(token: string) {
  return `${siteUrl()}/invite/${token}`;
}

function isRateLimitError(message: string) {
  return message.toLowerCase().includes("rate limit");
}

export async function getCopyableMagicLink(
  invite: Invite
): Promise<string | null> {
  if (!hasServiceRoleKey()) return null;

  const admin = createAdminClient();
  const redirectTo = inviteRedirectUrl(invite.token);

  for (const type of ["invite", "magiclink"] as const) {
    const { data, error } = await admin.auth.admin.generateLink({
      type,
      email: invite.email,
      options: { redirectTo },
    });
    if (!error && data?.properties?.action_link) {
      return data.properties.action_link;
    }
  }

  return null;
}

export async function sendInviteEmail(invite: Invite): Promise<{
  ok: boolean;
  method: "invite" | "otp" | "manual";
  error?: string;
  rateLimited?: boolean;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, method: "manual", error: "Supabase not configured" };
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

    if (isRateLimitError(inviteError.message)) {
      return {
        ok: false,
        method: "invite",
        error: inviteError.message,
        rateLimited: true,
      };
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
    return {
      ok: false,
      method: "otp",
      error: otpError.message,
      rateLimited: isRateLimitError(otpError.message),
    };
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

  let { error } = await supabase.auth.signInWithOtp({
    email: normalized,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: redirectTo,
    },
  });

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
    if (isRateLimitError(error.message)) {
      return {
        ok: false,
        error: "Too many emails sent. Wait 10–15 minutes and try again.",
      };
    }
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
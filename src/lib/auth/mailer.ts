import { createAdminClient, hasServiceRoleKey } from "@/lib/supabase/admin";
import {
  inviteEmailContent,
  isEmailDeliveryConfigured,
  loginEmailContent,
  sendTransactionalEmail,
} from "@/lib/auth/email-sender";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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

async function getLoginMagicLink(email: string): Promise<string | null> {
  if (!hasServiceRoleKey()) return null;
  const admin = createAdminClient();
  const redirectTo = `${siteUrl()}/auth/callback`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: email.trim().toLowerCase(),
    options: { redirectTo },
  });
  if (error || !data?.properties?.action_link) return null;
  return data.properties.action_link;
}

export async function sendInviteEmail(
  invite: Invite,
  options?: { orgName?: string }
): Promise<{
  ok: boolean;
  emailSent: boolean;
  method: "resend" | "manual";
  error?: string;
  testingOnly?: boolean;
  allowedTestEmail?: string;
  activationLink: string;
}> {
  const activationLink = getInvitePageUrl(invite.token);

  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      emailSent: false,
      method: "manual",
      error: "Supabase not configured",
      activationLink,
    };
  }

  if (!isEmailDeliveryConfigured()) {
    return {
      ok: false,
      emailSent: false,
      method: "manual",
      error: "RESEND_API_KEY is not configured on the server",
      activationLink,
    };
  }

  const content = inviteEmailContent({
    name: invite.name,
    activationLink,
    orgLabel: options?.orgName,
  });
  const sent = await sendTransactionalEmail({
    to: invite.email,
    ...content,
  });

  if (sent.ok) {
    return {
      ok: true,
      emailSent: true,
      method: "resend",
      activationLink,
    };
  }

  return {
    ok: false,
    emailSent: false,
    method: "resend",
    error: sent.error,
    testingOnly: sent.testingOnly,
    allowedTestEmail: sent.allowedTestEmail,
    activationLink,
  };
}

export async function sendLoginMagicLink(email: string): Promise<{
  ok: boolean;
  error?: string;
  rateLimited?: boolean;
  magicLink?: string;
}> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured" };
  }

  const normalized = email.trim().toLowerCase();
  const magicLink = await getLoginMagicLink(normalized);

  if (!magicLink) {
    return { ok: false, error: "Could not generate sign-in link" };
  }

  if (isEmailDeliveryConfigured()) {
    const content = loginEmailContent({ magicLink });
    const sent = await sendTransactionalEmail({
      to: normalized,
      ...content,
    });
    if (sent.ok) {
      return { ok: true };
    }
    return { ok: false, error: sent.error, magicLink };
  }

  const { createClient } = await import("@supabase/supabase-js");
  const { getSupabaseAnonKey, getSupabaseUrl } = await import(
    "@/lib/supabase/config"
  );
  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey());
  const redirectTo = `${siteUrl()}/auth/callback`;

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
        rateLimited: true,
        magicLink,
      };
    }
    return { ok: false, error: error.message, magicLink };
  }

  return { ok: true };
}
import {
  getInvitePageUrl,
  getCopyableMagicLink,
  sendInviteEmail,
} from "@/lib/auth/mailer";
import { isEmailDeliveryConfigured } from "@/lib/auth/email-sender";
import type { Invite } from "@/lib/types";

export type InviteDeliveryResult = {
  ok: boolean;
  emailSent?: boolean;
  rateLimited?: boolean;
  inviteLink: string;
  magicLink?: string | null;
  message?: string;
  error?: string;
  invite: Invite;
};

export async function deliverInvite(invite: Invite): Promise<InviteDeliveryResult> {
  const inviteLink = getInvitePageUrl(invite.token);
  const mail = await sendInviteEmail(invite);

  if (mail.ok) {
    return {
      ok: true,
      emailSent: true,
      inviteLink,
      message: `Activation email sent to ${invite.email}.`,
      invite,
    };
  }

  const magicLink = await getCopyableMagicLink(invite);
  const manualLink = magicLink ?? inviteLink;

  if (mail.rateLimited || !isEmailDeliveryConfigured()) {
    return {
      ok: true,
      emailSent: false,
      rateLimited: mail.rateLimited,
      inviteLink,
      magicLink: manualLink,
      message: isEmailDeliveryConfigured()
        ? "Supabase email limit reached. Copy the link below and send it manually."
        : "Invite created. Copy the activation link below and send it to them (email auto-send needs RESEND_API_KEY in Vercel).",
      invite,
    };
  }

  if (magicLink) {
    return {
      ok: true,
      emailSent: false,
      inviteLink,
      magicLink,
      message:
        "Automatic email could not be sent. Copy the activation link below and send it manually.",
      invite,
    };
  }

  return {
    ok: false,
    error: mail.error ?? "Failed to send invite email",
    inviteLink,
    invite,
  };
}
import {
  getInvitePageUrl,
  getCopyableMagicLink,
  sendInviteEmail,
} from "@/lib/auth/mailer";
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

  if (mail.rateLimited) {
    return {
      ok: true,
      emailSent: false,
      rateLimited: true,
      inviteLink,
      magicLink: manualLink,
      message:
        "Supabase email limit reached (too many emails in a short time). Copy the link below and send it to them yourself — text, Slack, or your own email.",
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
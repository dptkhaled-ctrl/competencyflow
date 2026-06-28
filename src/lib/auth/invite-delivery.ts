import {
  getInvitePageUrl,
  sendInviteEmail,
} from "@/lib/auth/mailer";
import { resendTestingMessage } from "@/lib/auth/email-sender";
import type { Invite } from "@/lib/types";

export type InviteDeliveryResult = {
  ok: boolean;
  emailSent: boolean;
  rateLimited?: boolean;
  inviteLink: string;
  magicLink?: string | null;
  message?: string;
  error?: string;
  invite: Invite;
};

export async function deliverInvite(
  invite: Invite,
  options?: { orgName?: string }
): Promise<InviteDeliveryResult> {
  const inviteLink = getInvitePageUrl(invite.token);
  const mail = await sendInviteEmail(invite, options);

  if (mail.emailSent) {
    return {
      ok: true,
      emailSent: true,
      inviteLink,
      magicLink: inviteLink,
      message: `Email sent to ${invite.email}. They should click the link and press "Activate my account". Check spam if it doesn't arrive within a minute.`,
      invite,
    };
  }

  if (mail.testingOnly) {
    return {
      ok: true,
      emailSent: false,
      inviteLink,
      magicLink: inviteLink,
      message: resendTestingMessage(mail.allowedTestEmail),
      error: mail.error,
      invite,
    };
  }

  return {
    ok: true,
    emailSent: false,
    inviteLink,
    magicLink: inviteLink,
    message: mail.error
      ? `Invite saved. Email could not be sent (${mail.error}). Copy the link below and send it to ${invite.email} — they can activate in one click.`
      : `Invite saved. Copy the link below and send it to ${invite.email}.`,
    error: mail.error,
    invite,
  };
}
type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function emailFromAddress(): string {
  return (
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    "CompetencyFlow <onboarding@resend.dev>"
  );
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "RESEND_API_KEY is not configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFromAddress(),
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text,
    }),
  });

  if (!res.ok) {
    let detail = `Resend error (${res.status})`;
    try {
      const body = await res.json();
      if (body?.message) detail = body.message;
    } catch {
      // ignore parse errors
    }
    return { ok: false, error: detail };
  }

  return { ok: true };
}

export function inviteEmailContent(input: {
  name: string;
  magicLink: string;
  orgLabel?: string;
}): { subject: string; html: string; text: string } {
  const subject = "You're invited to CompetencyFlow";
  const greeting = input.name ? `Hi ${input.name},` : "Hi,";
  const orgLine = input.orgLabel
    ? `<p>You've been invited to join <strong>${input.orgLabel}</strong> on CompetencyFlow.</p>`
    : "<p>You've been invited to join CompetencyFlow.</p>";

  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; line-height: 1.5;">
      <p>${greeting}</p>
      ${orgLine}
      <p>Click the button below to activate your account. This link expires in 14 days.</p>
      <p style="margin: 24px 0;">
        <a href="${input.magicLink}" style="background:#d97706;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Accept invitation
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Or copy this link: ${input.magicLink}</p>
    </div>
  `.trim();

  const text = [
    greeting,
    input.orgLabel
      ? `You've been invited to join ${input.orgLabel} on CompetencyFlow.`
      : "You've been invited to join CompetencyFlow.",
    "",
    "Open this link to activate your account:",
    input.magicLink,
  ].join("\n");

  return { subject, html, text };
}

export function loginEmailContent(input: {
  magicLink: string;
}): { subject: string; html: string; text: string } {
  const subject = "Your CompetencyFlow sign-in link";
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 520px; line-height: 1.5;">
      <p>Hi,</p>
      <p>Click below to sign in to CompetencyFlow. This link expires shortly.</p>
      <p style="margin: 24px 0;">
        <a href="${input.magicLink}" style="background:#d97706;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Sign in
        </a>
      </p>
      <p style="font-size:12px;color:#666;">If you didn't request this, you can ignore this email.</p>
    </div>
  `.trim();

  const text = [
    "Sign in to CompetencyFlow:",
    input.magicLink,
    "",
    "If you didn't request this, ignore this email.",
  ].join("\n");

  return { subject, html, text };
}
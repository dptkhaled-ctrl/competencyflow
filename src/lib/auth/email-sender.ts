type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export type SendEmailResult = {
  ok: boolean;
  error?: string;
  emailId?: string;
  testingOnly?: boolean;
  allowedTestEmail?: string;
};

function emailFromAddress(): string {
  let from =
    process.env.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    "onboarding@resend.dev";
  from = from.replace(/^["']|["']$/g, "").trim();
  if (!from.includes("<")) {
    from = `CompetencyFlow <${from}>`;
  }
  return from;
}

export function isEmailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

function parseResendTestingError(message: string): {
  testingOnly: boolean;
  allowedTestEmail?: string;
} {
  const lower = message.toLowerCase();
  if (!lower.includes("only send testing emails")) {
    return { testingOnly: false };
  }
  const match = message.match(/your own email address \(([^)]+)\)/i);
  return { testingOnly: true, allowedTestEmail: match?.[1] };
}

export async function sendTransactionalEmail(
  input: SendEmailInput
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
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
      to: [input.to.trim().toLowerCase()],
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
    const hint = parseResendTestingError(detail);
    return {
      ok: false,
      error: detail,
      testingOnly: hint.testingOnly,
      allowedTestEmail: hint.allowedTestEmail,
    };
  }

  let emailId: string | undefined;
  try {
    const body = await res.json();
    emailId = body?.id;
  } catch {
    // response may not be json
  }

  return { ok: true, emailId };
}

export function inviteEmailContent(input: {
  name: string;
  activationLink: string;
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
      <p>Click below to open your invite, create a password, and get started. This link expires in 14 days.</p>
      <p style="margin: 24px 0;">
        <a href="${input.activationLink}" style="background:#d97706;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
          Set up my account
        </a>
      </p>
      <p style="font-size:12px;color:#666;">Or copy this link: ${input.activationLink}</p>
    </div>
  `.trim();

  const text = [
    greeting,
    input.orgLabel
      ? `You've been invited to join ${input.orgLabel} on CompetencyFlow.`
      : "You've been invited to join CompetencyFlow.",
    "",
    "Open this link to activate your account:",
    input.activationLink,
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

export function resendTestingMessage(allowedTestEmail?: string): string {
  if (allowedTestEmail) {
    return `Resend test mode: auto-email only works to ${allowedTestEmail} until you verify your own domain at resend.com/domains. Copy the invite link below for everyone else.`;
  }
  return "Resend test mode: verify your domain at resend.com/domains to email any address. Copy the invite link below for now.";
}
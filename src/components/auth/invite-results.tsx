"use client";

import { CopyInviteLink } from "@/components/auth/copy-invite-link";

export type InviteResultRow = {
  name: string;
  email: string;
  ok: boolean;
  emailSent?: boolean;
  inviteLink?: string;
  message?: string;
  error?: string;
};

export function InviteResultsPanel({ results }: { results: InviteResultRow[] }) {
  const created = results.filter((r) => r.ok);
  const failed = results.filter((r) => !r.ok);
  const needsCopy = created.filter((r) => !r.emailSent && r.inviteLink);

  return (
    <div className="space-y-4 rounded-lg border border-amber-700/40 bg-amber-950/20 p-4">
      {created.length > 0 && (
        <p className="text-sm text-emerald-300">
          {created.length} invite{created.length > 1 ? "s" : ""} created.
          {needsCopy.length > 0
            ? " Copy each link below and text or email it to your staff — they’ll set a password and sign in."
            : " Staff will receive an email to set up their account."}
        </p>
      )}

      {needsCopy.length > 0 && (
        <p className="text-xs text-amber-200/90">
          Auto-email to any address needs a verified domain on Resend (free at{" "}
          <a
            href="https://resend.com/domains"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            resend.com/domains
          </a>
          ). You do not need to pay Supabase.
        </p>
      )}

      <div className="space-y-3 max-h-[40vh] overflow-auto">
        {results.map((row) =>
          row.ok && row.inviteLink ? (
            <div key={row.email} className="rounded-md border bg-background/50 p-3">
              <p className="text-sm font-medium">
                {row.name}{" "}
                <span className="font-normal text-muted-foreground">({row.email})</span>
              </p>
              {row.emailSent ? (
                <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                  Email sent — backup link below if they don’t see it.
                </p>
              ) : (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Copy this link and send it to them.
                </p>
              )}
              <CopyInviteLink
                link={row.inviteLink}
                label={`Invite link for ${row.name}`}
              />
            </div>
          ) : null
        )}
      </div>

      {failed.map((row) => (
        <p key={row.email} className="text-sm text-red-400">
          {row.name} ({row.email}): {row.error ?? "Failed"}
        </p>
      ))}
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, GraduationCap, Loader2, Mail, Shield } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type InviteInfo = {
  email: string;
  name: string;
  role: "staff" | "manager";
  orgName?: string;
  teamName?: string;
};

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "Unexpected server response" };
  }
}

export function InviteAccept({ token }: { token: string }) {
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invites/${token}`)
      .then(parseJsonSafe)
      .then((data) => {
        if (data.error) {
          setError(String(data.error));
        } else {
          setInvite(data as InviteInfo);
        }
      })
      .catch(() => setError("Could not load invite"))
      .finally(() => setLoading(false));
  }, [token]);

  const activateNow = async () => {
    setSending(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/invites/${token}/activate`, {
        method: "POST",
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(data.error ?? "Could not activate account"));
      }
      const redirectUrl = String(data.redirectUrl ?? "");
      if (!redirectUrl) {
        throw new Error("No activation link returned");
      }
      setMessage("Redirecting you to sign in…");
      window.location.assign(redirectUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!invite) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Invite not found</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>{error ?? "This invite may have expired. Ask your administrator for a new one."}</p>
            <Link href="/login" className={buttonVariants()}>
              Go to sign in
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const roleLabel = invite.role === "manager" ? "Manager" : "Staff member";

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-100 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">You&apos;re invited</h1>
          <p className="mt-2 text-slate-600">
            Welcome to CompetencyFlow — compliance training built for healthcare teams.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Account activation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-lg bg-muted/60 p-4 space-y-2">
              <p>
                <strong>{invite.name}</strong>
              </p>
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {invite.email}
              </p>
              <p className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-600" />
                Role: <strong>{roleLabel}</strong>
              </p>
              {invite.orgName && (
                <p className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  {invite.orgName}
                  {invite.teamName ? ` · ${invite.teamName}` : ""}
                </p>
              )}
            </div>

            <p className="text-muted-foreground">
              Click below to activate your account. You&apos;ll be signed in automatically —
              no password to remember.
            </p>

            <Button className="w-full" onClick={() => void activateNow()} disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Activating…
                </>
              ) : (
                "Activate my account"
              )}
            </Button>

            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800">{message}</p>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
            Already activated? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Building2, GraduationCap, Loader2, Lock, Mail, Shield } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const searchParams = useSearchParams();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urlError = searchParams.get("error");
    if (urlError) setError(urlError);
  }, [searchParams]);

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

  const completeSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/invites/${token}/setup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const data = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(String(data.error ?? "Could not complete setup"));
      }

      const redirectTo = String(data.redirectTo ?? "/");
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set up account");
      setSubmitting(false);
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
            Create your password below — then you&apos;re in.
          </p>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg">Set up your account</CardTitle>
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

            <form onSubmit={completeSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Create password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    className="pl-8"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    className="pl-8"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    minLength={8}
                    required
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating your account…
                  </>
                ) : (
                  "Create account & continue"
                )}
              </Button>
            </form>

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{error}</p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className={cn(buttonVariants({ variant: "ghost" }))}>
            Already set up? Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
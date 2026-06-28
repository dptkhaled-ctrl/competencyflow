"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Lock, Mail } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/app-store";

async function parseJsonSafe(res: Response) {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: "Unexpected server response" };
  }
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const isConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
        }),
      });
      const data = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(String(data.error ?? "Could not sign in"));
      }

      const redirectTo = String(data.redirectTo ?? "/");
      if (data.userId) {
        await useAppStore.getState().hydrateFromServer();
        useAppStore.getState().setCurrentUser(String(data.userId));
      }
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotLoading(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await parseJsonSafe(res);
      if (!res.ok) {
        throw new Error(String(data.error ?? "Could not send reset email"));
      }
      setMessage(
        String(
          data.message ??
            "If an account exists, we sent reset instructions to your email."
        )
      );
      setShowForgot(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Sign-in is not configured. Contact your administrator.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 px-4 py-12 text-white">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500">
              <GraduationCap className="h-5 w-5" />
            </div>
            CompetencyFlow
          </Link>
          <h1 className="mt-6 text-3xl font-bold">
            {showForgot ? "Reset password" : "Sign in"}
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            {showForgot
              ? "Enter your work email and we'll send reset instructions."
              : "Use the email and password from your invite."}
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 text-white backdrop-blur">
          <CardContent className="pt-6">
            {showForgot ? (
              <form onSubmit={handleForgot} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email" className="text-slate-200">
                    Work email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="forgot-email"
                      type="email"
                      className="border-white/10 bg-white/10 pl-8 text-white"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send reset email"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full text-slate-300"
                  onClick={() => setShowForgot(false)}
                >
                  Back to sign in
                </Button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-200">
                    Work email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="email"
                      type="email"
                      className="border-white/10 bg-white/10 pl-8 text-white placeholder:text-slate-400"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@organization.com"
                      required
                      autoComplete="email"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-slate-200">
                      Password
                    </Label>
                    <button
                      type="button"
                      className="text-xs text-indigo-300 hover:text-indigo-200"
                      onClick={() => {
                        setShowForgot(true);
                        setError(null);
                        setMessage(null);
                      }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      id="password"
                      type="password"
                      className="border-white/10 bg-white/10 pl-8 text-white placeholder:text-slate-400"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Your password"
                      required
                      autoComplete="current-password"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    "Sign in"
                  )}
                </Button>
              </form>
            )}

            {message && (
              <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                {message}
              </p>
            )}
            {error && (
              <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            {!showForgot && (
              <p className="mt-6 text-center text-xs text-slate-400">
                First time? Open the invite link from your administrator to create
                your account.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-slate-400">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "text-slate-300")}>
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
"use client";

import { useState } from "react";
import Link from "next/link";
import { GraduationCap, Loader2, Lock, Mail } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

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

  const isConfigured =
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
    Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

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
      window.location.assign(redirectTo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Sign-in not configured</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Supabase keys are missing. Contact your administrator.
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
          <h1 className="mt-6 text-3xl font-bold">Sign in</h1>
          <p className="mt-2 text-sm text-slate-300">
            Use the email and password you set when you accepted your invite.
          </p>
        </div>

        <Card className="border-white/10 bg-white/5 text-white backdrop-blur">
          <CardContent className="pt-6">
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
                <Label htmlFor="password" className="text-slate-200">
                  Password
                </Label>
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

            {error && (
              <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {error}
              </p>
            )}

            <p className="mt-6 text-center text-xs text-slate-400">
              First time here? Open the invite link from your administrator to
              create your password.
            </p>
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
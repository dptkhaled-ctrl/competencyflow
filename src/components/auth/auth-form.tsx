"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2, Mail, Phone, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

type AuthMode = "sign-in" | "sign-up";

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

async function completeProfile(input: {
  name: string;
  role: UserRole;
  phone?: string;
}) {
  const res = await fetch("/api/auth/complete-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Could not finish setup");
  return data;
}

const isConfigured =
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function AuthForm() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>("sign-in");
  const [tab, setTab] = useState("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);

  const redirectForRole = (userRole: UserRole) => {
    router.push(userRole === "manager" ? "/manager" : "/staff");
    router.refresh();
  };

  const finishLogin = async (userRole?: UserRole) => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();

    if (!data.authenticated) {
      setNeedsProfile(true);
      setMessage("Almost done — tell us your name to finish setup.");
      return;
    }

    redirectForRole(userRole ?? data.user.role);
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      if (mode === "sign-up") {
        if (!name.trim()) throw new Error("Enter your full name");
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim(), role },
          },
        });
        if (signUpError) throw signUpError;

        if (data.session) {
          await completeProfile({ name: name.trim(), role });
          await finishLogin(role);
          return;
        }

        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (signInError) {
          setMessage(
            "Account created. Check your email to confirm, then sign in here."
          );
          setMode("sign-in");
          return;
        }

        await completeProfile({ name: name.trim(), role });
        await finishLogin(role);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      await finishLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const formatted = phone.trim().startsWith("+")
        ? phone.trim()
        : `+1${phone.replace(/\D/g, "")}`;

      const { error: otpError } = await supabase.auth.signInWithOtp({
        phone: formatted,
      });
      if (otpError) throw otpError;

      setPhone(formatted);
      setOtpSent(true);
      setMessage("Code sent. Check your phone and enter it below.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        phone,
        token: otp.trim(),
        type: "sms",
      });
      if (verifyError) throw verifyError;

      const res = await fetch("/api/auth/me");
      const data = await res.json();
      if (!data.authenticated) {
        setNeedsProfile(true);
        setMessage("Enter your name to finish phone sign-in.");
        return;
      }

      redirectForRole(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!name.trim()) throw new Error("Enter your full name");
      const data = await completeProfile({
        name: name.trim(),
        role,
        phone: tab === "phone" ? phone : undefined,
      });
      redirectForRole(data.user.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setLoading(false);
    }
  };

  if (!isConfigured) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50 px-4 py-10">
        <div className="mx-auto max-w-md text-center">
          <h1 className="text-2xl font-bold">Auth not set up yet</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Add your Supabase keys to <code>.env.local</code> and redeploy.
            See <code>SETUP-SUPABASE.txt</code> in the project folder.
          </p>
          <Link
            href="/"
            className={cn(buttonVariants({ className: "mt-6" }))}
          >
            Back to demo mode
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50 px-4 py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">CompetencyFlow</h1>
          <p className="mt-2 text-sm text-slate-600">
            Sign in with email or phone. No complicated setup.
          </p>
        </div>

        <Card className="border-slate-200/80 shadow-lg shadow-slate-200/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-center text-lg">
              {needsProfile
                ? "Finish your account"
                : mode === "sign-in"
                  ? "Welcome back"
                  : "Create your account"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {needsProfile ? (
              <form onSubmit={handleCompleteProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="profile-name">Full name</Label>
                  <div className="relative">
                    <User className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="profile-name"
                      className="pl-8"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Sam Rivera"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>I am a</Label>
                  <Select
                    value={role}
                    onValueChange={(v) => setRole(v as UserRole)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Staff member</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    "Continue to app"
                  )}
                </Button>
              </form>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1">
                  <Button
                    type="button"
                    variant={mode === "sign-in" ? "default" : "ghost"}
                    onClick={() => setMode("sign-in")}
                  >
                    Sign in
                  </Button>
                  <Button
                    type="button"
                    variant={mode === "sign-up" ? "default" : "ghost"}
                    onClick={() => setMode("sign-up")}
                  >
                    Sign up
                  </Button>
                </div>

                <Tabs value={tab} onValueChange={setTab}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="email">
                      <Mail className="h-4 w-4" />
                      Email
                    </TabsTrigger>
                    <TabsTrigger value="phone">
                      <Phone className="h-4 w-4" />
                      Phone
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="email" className="mt-4">
                    <form onSubmit={handleEmailSubmit} className="space-y-4">
                      {mode === "sign-up" && (
                        <div className="space-y-2">
                          <Label htmlFor="name">Full name</Label>
                          <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Sam Rivera"
                            required
                          />
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@company.com"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="password">Password</Label>
                        <Input
                          id="password"
                          type="password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="At least 6 characters"
                          minLength={6}
                          required
                        />
                      </div>
                      {mode === "sign-up" && (
                        <div className="space-y-2">
                          <Label>I am a</Label>
                          <Select
                            value={role}
                            onValueChange={(v) => setRole(v as UserRole)}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Staff member</SelectItem>
                              <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Working…
                          </>
                        ) : mode === "sign-in" ? (
                          "Sign in with email"
                        ) : (
                          `Create account (${initials(name || "CF")})`
                        )}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="phone" className="mt-4">
                    {!otpSent ? (
                      <form onSubmit={handleSendOtp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="phone">Phone number</Label>
                          <Input
                            id="phone"
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="+1 555 123 4567"
                            required
                          />
                          <p className="text-xs text-muted-foreground">
                            We&apos;ll text you a one-time code. US numbers can
                            omit +1.
                          </p>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Sending…
                            </>
                          ) : (
                            "Send code"
                          )}
                        </Button>
                      </form>
                    ) : (
                      <form onSubmit={handleVerifyOtp} className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="otp">Verification code</Label>
                          <Input
                            id="otp"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value)}
                            placeholder="123456"
                            inputMode="numeric"
                            required
                          />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                          {loading ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Verifying…
                            </>
                          ) : (
                            "Verify & sign in"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="w-full"
                          onClick={() => {
                            setOtpSent(false);
                            setOtp("");
                          }}
                        >
                          Use a different number
                        </Button>
                      </form>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            )}

            {message && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {message}
              </p>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            Try demo mode instead
          </Link>
          {" · "}
          <Link href="/admin/login" className="underline underline-offset-4">
            Platform admin
          </Link>
        </p>
      </div>
    </div>
  );
}
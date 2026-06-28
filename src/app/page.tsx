"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BookOpen, GraduationCap, LayoutDashboard, LogIn, Shield, Users } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { useAppStore } from "@/lib/store/app-store";

function WelcomeScreen() {
  const router = useRouter();
  const users = useAppStore((s) => s.users);
  const organizations = useAppStore((s) => s.organizations);
  const hydrated = useAppStore((s) => s.hydrated);
  const setCurrentUser = useAppStore((s) => s.setCurrentUser);

  useEffect(() => {
    void useAppStore.getState().hydrateFromServer();
  }, []);

  const startAs = (userId: string) => {
    const user = users.find((u) => u.id === userId)!;
    setCurrentUser(userId);
    router.push(user.role === "manager" ? "/manager" : "/staff");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-orange-50">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
            <GraduationCap className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl text-slate-900">
            CompetencyFlow
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-slate-600">
            Structured micro-lessons and quizzes for SNFs, Behavioral Health, and Home Health.
            Managers get visibility into staff questions and progress.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className={cn(buttonVariants({ size: "lg" }), "gap-2")}
            >
              <LogIn className="h-4 w-4" />
              Sign in or create account
            </Link>
            <Link
              href="/login"
              className={buttonVariants({ variant: "outline", size: "lg" })}
            >
              Use email or phone
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm font-medium text-muted-foreground">
          Or try the demo without signing in
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer border-primary/20 transition-shadow hover:shadow-md"
            onClick={() => startAs("user-snf-1")}
          >
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <BookOpen className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold">I&apos;m Staff (SNF / Behavioral Health / Home Health)</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Structured lessons with quizzes, plus instant Ask Policy help grounded in your materials.
                </p>
                <Button className="mt-4 w-full" onClick={() => startAs("user-snf-1")}>
                  Start as Sam Rivera
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-primary/20 transition-shadow hover:shadow-md"
            onClick={() => startAs("user-snf-mgr")}
          >
            <CardContent className="flex items-start gap-4 pt-6">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <LayoutDashboard className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-semibold">I&apos;m a Manager</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Competency heatmaps, gap alerts, and AI assistant to assign topics.
                </p>
                <Button
                  className="mt-4 w-full"
                  variant="secondary"
                  onClick={() => startAs("user-snf-mgr")}
                >
                  Start as Jordan Lee
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Admin entrance - easy access for uploading docs, managing orgs, users, etc. */}
        <div className="mt-6">
          <Card
            className="cursor-pointer border-amber-200 bg-amber-50/60 transition-shadow hover:shadow-md"
            onClick={() => router.push("/admin/login")}
          >
            <CardContent className="flex items-start gap-4 pt-5">
              <div className="rounded-xl bg-amber-100 p-3 text-amber-600">
                <Shield className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h2 className="font-semibold">I&apos;m Platform Admin</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Onboard new SNF, Behavioral Health, or Home Health organizations, upload policies/SOPs/PDFs, manage users, and trigger AI lesson generation.
                </p>
                <div className="mt-3 text-xs text-amber-700">
                  Login password: <span className="font-mono">CompetencyFlow2026!</span> (see .env.local)
                </div>
                <Button
                  className="mt-3 w-full"
                  variant="outline"
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push("/admin/login");
                  }}
                >
                  Go to Admin Login
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">
            <span className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Or pick another demo person (all orgs, including ones you add in Admin)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void useAppStore.getState().hydrateFromServer()}
            >
              {hydrated ? "Refresh list" : "Loading…"}
            </Button>
          </div>
          <div className="space-y-4">
            {(organizations && organizations.length > 0 ? organizations : []).map((org: any) => {
              const orgUsers = users.filter((u) => u.orgId === org.id);
              return (
                <Card key={org.id}>
                  <CardContent className="pt-5">
                    <p className="text-sm font-medium">{org.name}</p>
                    <p className="text-xs text-muted-foreground">{org.industry}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {orgUsers.length > 0 ? (
                        orgUsers.map((user) => (
                          <Button
                            key={user.id}
                            variant="outline"
                            size="sm"
                            onClick={() => startAs(user.id)}
                          >
                            {user.name}
                            <span className="ml-1 text-muted-foreground capitalize">
                              ({user.role})
                            </span>
                          </Button>
                        ))
                      ) : (
                        <span className="text-xs text-muted-foreground">No users yet — add via Admin → People & Orgs</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Tip: use the menu in the top-right anytime to switch between people.
        </p>
      </div>
    </div>
  );
}

export default function HomePage() {
  return <WelcomeScreen />;
}
"use client";

import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  GraduationCap,
  MessageSquare,
  Shield,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: BookOpen,
    title: "Policy-grounded lessons",
    description:
      "Turn your SOPs, policies, and PDFs into structured micro-lessons with quizzes — automatically.",
  },
  {
    icon: MessageSquare,
    title: "Ask Policy assistant",
    description:
      "Staff get instant answers cited from your organization's uploaded materials — not generic AI guesses.",
  },
  {
    icon: BarChart3,
    title: "Manager visibility",
    description:
      "See completion rates, competency gaps, and at-risk staff. Assign refreshers in one click.",
  },
  {
    icon: Shield,
    title: "Built for healthcare compliance",
    description:
      "Designed for SNFs, Behavioral Health, and Home Health — with category tracking auditors expect.",
  },
];

const steps = [
  "Administrator onboards your organization and invites managers",
  "Managers invite staff by email — each person gets a secure activation link",
  "Staff complete lessons and quizzes; managers monitor progress in real time",
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <GraduationCap className="h-5 w-5" />
            </div>
            CompetencyFlow
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
            >
              Sign in
            </Link>
            <Link href="/contact" className={buttonVariants({ size: "sm" })}>
              Contact us
            </Link>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
          <div className="max-w-2xl">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm">
              <Building2 className="h-4 w-4" />
              Healthcare workforce training platform
            </p>
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              Turn policies into competency your team can prove
            </h1>
            <p className="mt-6 text-lg text-indigo-100 sm:text-xl">
              CompetencyFlow helps SNFs, Behavioral Health, and Home Health organizations
              train staff on real policies, track mastery, and give managers the visibility
              regulators and families expect.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ size: "lg" }),
                  "bg-white text-indigo-700 hover:bg-indigo-50"
                )}
              >
                Sign in to your account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/contact"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "border-white/40 bg-transparent text-white hover:bg-white/10"
                )}
              >
                Request a demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:py-20">
        <h2 className="text-center text-3xl font-bold">Why teams choose CompetencyFlow</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Replace scattered PDFs and verbal training with a single system your staff
          actually uses — and your managers can audit.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          {features.map((f) => (
            <Card key={f.title} className="border-slate-200/80 shadow-sm">
              <CardContent className="flex gap-4 pt-6">
                <div className="rounded-xl bg-indigo-50 p-3 text-indigo-600">
                  <f.icon className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="bg-slate-50 py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-center text-3xl font-bold">How onboarding works</h2>
          <ol className="mx-auto mt-10 max-w-2xl space-y-4">
            {steps.map((step, i) => (
              <li key={step} className="flex gap-4 rounded-xl border bg-white p-4 shadow-sm">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-1 text-sm sm:text-base">{step}</span>
              </li>
            ))}
          </ol>
          <p className="mt-8 text-center text-sm text-muted-foreground">
            Accounts are invite-only. Staff and managers receive a secure email link —
            no public self-registration.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-20">
        <h2 className="text-3xl font-bold">Ready to bring order to staff training?</h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Existing users can sign in anytime. New organizations — reach out and we&apos;ll
          get you set up with your first site and manager accounts.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/login" className={buttonVariants({ size: "lg" })}>
            Sign in
          </Link>
          <Link href="/contact" className={buttonVariants({ variant: "outline", size: "lg" })}>
            Contact us
          </Link>
        </div>
      </section>

      <footer className="border-t bg-slate-950 py-10 text-slate-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm">
            <GraduationCap className="h-4 w-4" />
            CompetencyFlow
          </div>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="hover:text-white">
              Sign in
            </Link>
            <Link href="/contact" className="hover:text-white">
              Contact
            </Link>
            <Link href="/admin/login" className="hover:text-white">
              Platform admin
            </Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} CompetencyFlow. Healthcare competency & compliance training.
        </p>
      </footer>
    </div>
  );
}
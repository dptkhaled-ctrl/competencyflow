import Link from "next/link";
import { GraduationCap, Mail, Phone } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <GraduationCap className="h-5 w-5 text-indigo-600" />
            CompetencyFlow
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Sign in
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-3xl font-bold">Contact us</h1>
        <p className="mt-3 text-muted-foreground">
          Interested in CompetencyFlow for your organization? We&apos;ll help you onboard
          your first site, invite managers, and upload your policy library.
        </p>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Get in touch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-indigo-600" />
              <a href="mailto:hello@competencyflow.com" className="font-medium hover:underline">
                hello@competencyflow.com
              </a>
            </p>
            <p className="flex items-center gap-3 text-muted-foreground">
              <Phone className="h-5 w-5" />
              Schedule a walkthrough — we typically respond within one business day.
            </p>
            <a
              href="mailto:hello@competencyflow.com?subject=CompetencyFlow%20demo%20request"
              className={buttonVariants({ className: "mt-2 inline-flex" })}
            >
              Email us to request a demo
            </a>
          </CardContent>
        </Card>

        <p className="mt-8 text-center text-sm text-muted-foreground">
          <Link href="/" className="underline underline-offset-4">
            ← Back to home
          </Link>
        </p>
      </main>
    </div>
  );
}
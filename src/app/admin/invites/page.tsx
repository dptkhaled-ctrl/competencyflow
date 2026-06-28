"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Mail, UserPlus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CopyInviteLink } from "@/components/auth/copy-invite-link";
import type { Invite, Organization, Team } from "@/lib/types";

type InviteRow = Invite & { inviteLink?: string };

export default function AdminInvitesPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [manualLink, setManualLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    orgId: "",
    teamId: "",
  });

  const loadInvites = async (orgId: string) => {
    const invRes = await fetch(`/api/admin/invites?orgId=${orgId}`);
    const invData = await invRes.json();
    setInvites(invData.invites ?? []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const platformRes = await fetch("/api/admin/platform");
        const platform = await platformRes.json();
        if (cancelled) return;
        setOrganizations(platform.organizations ?? []);
        setTeams(platform.teams ?? []);
        const orgId = platform.organizations?.[0]?.id;
        if (orgId) {
          const firstTeam = (platform.teams ?? []).find((t: Team) => t.orgId === orgId);
          setForm((f) => ({
            ...f,
            orgId: f.orgId || orgId,
            teamId: f.teamId || firstTeam?.id || "",
          }));
          await loadInvites(orgId);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (form.orgId) void loadInvites(form.orgId);
  }, [form.orgId]);

  const orgTeams = teams.filter((t) => t.orgId === form.orgId);

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setError(null);
    setMessage(null);
    setManualLink(null);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) {
        if (data.inviteLink) setManualLink(data.magicLink ?? data.inviteLink);
        throw new Error(data.error ?? "Failed to send invite");
      }

      setMessage(
        data.message ??
          (data.emailSent
            ? `Invitation email sent to ${form.email}. Check spam if it doesn't arrive.`
            : "Invite created — copy the link below and send it to the manager.")
      );
      setManualLink(data.magicLink ?? data.inviteLink ?? null);
      setForm((f) => ({ ...f, name: "", email: "" }));
      if (form.orgId) await loadInvites(form.orgId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <Link
        href="/admin"
        className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-6")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>

      <h1 className="text-2xl font-bold mb-2">Invite managers</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Add a manager by email. They&apos;ll receive a professional activation email with a
        magic link — no password setup required.
      </p>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            New manager invite
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={sendInvite} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jordan Lee"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Work email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="manager@facility.com"
                  required
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={form.orgId}
                  onValueChange={(orgId) => {
                    if (!orgId) return;
                    const team = teams.find((t) => t.orgId === orgId);
                    setForm({ ...form, orgId, teamId: team?.id ?? "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select org" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((o) => (
                      <SelectItem key={o.id} value={o.id}>
                        {o.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Team</Label>
                <Select
                  value={form.teamId}
                  onValueChange={(teamId) => {
                    if (!teamId) return;
                    setForm({ ...form, teamId });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {orgTeams.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Send manager invite email
                </>
              )}
            </Button>
          </form>
          {message && (
            <p
              className={cn(
                "mt-4 rounded-lg border px-3 py-2 text-sm",
                manualLink && !message.includes("Email sent")
                  ? "border-amber-700 bg-amber-950/40 text-amber-200"
                  : "border-emerald-800 bg-emerald-950/50 text-emerald-300"
              )}
            >
              {message}
            </p>
          )}
          {manualLink && (
            <CopyInviteLink
              link={manualLink}
              label={
                message?.includes("Email sent")
                  ? "Backup invite link (if email doesn't arrive)"
                  : "Copy this invite link and send it to the manager"
              }
            />
          )}
          {error && (
            <p className="mt-4 rounded-lg bg-red-950/50 border border-red-800 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manager invites</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : invites.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invites yet for this organization.</p>
          ) : (
            invites.map((inv) => (
              <div
                key={inv.id}
                className="rounded-lg border border-slate-700 p-3 text-sm space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{inv.name}</p>
                    <p className="text-muted-foreground">{inv.email}</p>
                  </div>
                  <Badge variant={inv.status === "accepted" ? "default" : "secondary"}>
                    {inv.status}
                  </Badge>
                </div>
                {inv.status === "pending" && inv.inviteLink && (
                  <CopyInviteLink link={inv.inviteLink} label="Share this invite link" />
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
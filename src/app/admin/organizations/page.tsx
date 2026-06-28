"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  GraduationCap,
  Loader2,
  Upload,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Organization } from "@/lib/types";

interface OrgSummary extends Organization {
  staffCount?: number;
  fileCount?: number;
  lessonCount?: number;
}

export default function AdminOrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/platform")
      .then((r) => r.json())
      .then((data) => {
        const summaries = (data.organizations as Organization[]).map((org) => ({
          ...org,
          staffCount: (data.users as { orgId: string; role: string }[]).filter(
            (u) => u.orgId === org.id && u.role === "staff"
          ).length,
          fileCount: (data.uploadedMaterials as { orgId: string }[]).filter(
            (m) => m.orgId === org.id
          ).length,
          lessonCount: (data.lessons as { orgId: string }[]).filter(
            (l) => l.orgId === org.id
          ).length,
        }));
        setOrgs(summaries);
        setLoading(false);
      });
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Open any client to view their uploads, users, and training
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading organizations…
        </div>
      ) : orgs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No organizations yet.{" "}
            <Link href="/admin/database" className="underline">
              Add one in the database
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {orgs.map((org) => (
            <Card
              key={org.id}
              className="transition-colors hover:border-accent/40"
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Building2 className="h-4 w-4 text-amber-400" />
                    {org.name}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-muted-foreground/50"
                  >
                    {org.orgType ?? "snf"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{org.industry}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-lg font-bold">{org.staffCount}</p>
                    <p className="text-[10px] text-muted-foreground">Staff</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-lg font-bold">{org.fileCount}</p>
                    <p className="text-[10px] text-muted-foreground">Files</p>
                  </div>
                  <div className="rounded-lg bg-muted p-2">
                    <p className="text-lg font-bold">{org.lessonCount}</p>
                    <p className="text-[10px] text-muted-foreground">Lessons</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/admin/organizations/${org.id}`}
                    className={cn(
                      buttonVariants({ size: "sm" }),
                      "flex-1"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    View org
                  </Link>
                  <Link
                    href={`/admin/upload?org=${org.id}`}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" })
                    )}
                  >
                    <Upload className="h-4 w-4" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
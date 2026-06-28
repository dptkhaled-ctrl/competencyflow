"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FileText,
  Loader2,
  Trash2,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Organization, UploadedMaterial } from "@/lib/types";

interface PlatformSummary {
  organizations: Organization[];
  uploadedMaterials: Array<
    Pick<
      UploadedMaterial,
      | "id"
      | "orgId"
      | "fileName"
      | "status"
      | "lessonIds"
      | "uploadedAt"
      | "fileType"
      | "fileSize"
      | "assignedCategories"
    >
  >;
}

export default function AdminFilesPage() {
  const [data, setData] = useState<PlatformSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<
    PlatformSummary["uploadedMaterials"][number] | null
  >(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    fetch("/api/platform")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      });
  };

  useEffect(() => {
    load();
  }, []);

  const confirmDelete = async (deleteLessons: boolean) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/files/${deleteTarget.id}?deleteLessons=${deleteLessons}`,
        { method: "DELETE" }
      );
      const result = await res.json();
      if (!res.ok) {
        alert(result.error ?? "Delete failed");
        return;
      }
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  const materials = data?.uploadedMaterials ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">File library</h1>
        <p className="text-sm text-slate-400">
          Manage uploaded client materials — or open an organization for org-specific files
        </p>
      </div>

      <Card className="border-slate-700 bg-slate-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            All uploads ({materials.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading…
            </div>
          ) : materials.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">
              No files yet.{" "}
              <Link href="/admin/upload" className="text-amber-400 underline">
                Upload one
              </Link>
            </p>
          ) : (
            materials.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-700 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{m.fileName}</p>
                  <p className="text-xs text-slate-400">
                    {data?.organizations.find((o) => o.id === m.orgId)?.name} ·{" "}
                    {new Date(m.uploadedAt).toLocaleDateString()} ·{" "}
                    {Math.round(m.fileSize / 1024)} KB
                  </p>
                  {m.assignedCategories && m.assignedCategories.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {m.assignedCategories.map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">{c}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {m.lessonIds.length > 0 && (
                    <Badge variant="secondary">{m.lessonIds.length} lessons</Badge>
                  )}
                  <Badge variant="outline">{m.status}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-400 hover:text-red-300"
                    onClick={() => setDeleteTarget(m)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription className="text-slate-400">
              {deleteTarget?.fileName}
              {deleteTarget && deleteTarget.lessonIds.length > 0 && (
                <>
                  {" "}
                  — this file has {deleteTarget.lessonIds.length} associated
                  lesson{deleteTarget.lessonIds.length > 1 ? "s" : ""}.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            {deleteTarget && deleteTarget.lessonIds.length > 0 ? (
              <>
                <Button
                  variant="destructive"
                  disabled={deleting}
                  onClick={() => confirmDelete(true)}
                >
                  Delete file and lessons
                </Button>
                <Button
                  variant="outline"
                  className="border-slate-600"
                  disabled={deleting}
                  onClick={() => confirmDelete(false)}
                >
                  Delete file only (keep lessons)
                </Button>
              </>
            ) : (
              <Button
                variant="destructive"
                disabled={deleting}
                onClick={() => confirmDelete(false)}
              >
                Delete file
              </Button>
            )}
            <Button
              variant="ghost"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
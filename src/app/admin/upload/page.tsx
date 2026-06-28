"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Loader2,
  Upload,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Organization, OrgType } from "@/lib/types";
import { getCategoriesForOrgType } from "@/lib/competency/domains";

const ACCEPTED =
  ".pdf,.docx,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp";

function AdminUploadPageContent() {
  const searchParams = useSearchParams();
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState("");
  const [selectedOrgType, setSelectedOrgType] = useState<OrgType>("snf");
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState<
    Array<{ name: string; ok: boolean; message: string }>
  >([]);

  // Per-upload review state for the new mandatory category confirmation flow
  interface ReviewItem {
    materialId: string;
    fileName: string;
    orgId: string;
    orgType: OrgType;
    suggested: string[];
    chosen: string[];
    status: "pending" | "suggesting" | "ready" | "confirming" | "done" | "error";
    message?: string;
    lessonsCreated?: number;
  }
  const [reviews, setReviews] = useState<ReviewItem[]>([]);

  useEffect(() => {
    fetch("/api/platform")
      .then((r) => r.json())
      .then((d) => {
        const loadedOrgs: Organization[] = d.organizations ?? [];
        setOrgs(loadedOrgs);
        const preset = searchParams.get("org");
        const initialOrgId = preset || (loadedOrgs[0]?.id ?? "");
        setOrgId(initialOrgId);
        const initialOrg = loadedOrgs.find((o) => o.id === initialOrgId);
        setSelectedOrgType((initialOrg?.orgType as OrgType) || "snf");
      });
  }, [searchParams]);

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      if (!orgId) return;
      setUploading(true);
      const newResults: typeof results = [];

      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("orgId", orgId);
        form.append("file", file);

        try {
          const res = await fetch("/api/admin/upload", {
            method: "POST",
            body: form,
          });
          const data = await res.json();
          newResults.push({
            name: file.name,
            ok: res.ok && data.ok !== false,
            message: data.message ?? data.error ?? "Done",
          });

          // Seed a review item for the new mandatory category confirmation step (only on success)
          if (res.ok && data.materialId && data.ok !== false) {
            setReviews((prev) => {
              if (prev.some((r) => r.materialId === data.materialId)) return prev;
              return [
                ...prev,
                {
                  materialId: data.materialId,
                  fileName: file.name,
                  orgId,
                  orgType: selectedOrgType,
                  suggested: [],
                  chosen: [],
                  status: "pending",
                },
              ];
            });
          }
        } catch {
          newResults.push({
            name: file.name,
            ok: false,
            message: "Upload failed",
          });
        }
      }

      setResults((prev) => [...newResults, ...prev]);
      setUploading(false);
    },
    [orgId]
  );

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/admin"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "mb-6 text-muted-foreground"
        )}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to admin
      </Link>

      <h1 className="text-2xl font-bold mb-2">Document Upload — Categorized Processing</h1>
      <p className="text-sm text-muted-foreground mb-4">
        1. Select organization (and its type). 2. Upload file. 3. AI suggests the best-matching category(ies) from the org type's official list.
        <strong> You must review, edit (multi-select supported), and explicitly confirm</strong> before any AI lesson/quiz processing happens.
        This ensures the document is correctly tagged for staff visibility, manager dashboards, and compliance tracking. Only confirmed categories trigger lesson generation.
      </p>
      <div className="mb-8 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-foreground/80">
        Requires OpenAI API key in <code className="font-mono">.env.local</code> — see FOUNDER-GUIDE.txt
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Step 1 — Select client</CardTitle>
        </CardHeader>
        <CardContent>
          <Label className="text-muted-foreground">Organization</Label>
          <Select
            value={orgId}
            onValueChange={(v) => {
              if (!v) return;
              setOrgId(v);
              const chosen = orgs.find((o) => o.id === v);
              const t = (chosen?.orgType as OrgType) || "snf";
              setSelectedOrgType(t);
              // Reset reviews when switching org (they are org-scoped)
              setReviews([]);
            }}
          >
            <SelectTrigger className="mt-2 border-slate-700 bg-slate-800">
              <SelectValue placeholder="Choose client" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.name} ({o.industry})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Explicit Organization Type selector — determines the exact category list used for AI suggestions + confirmation (per your required flow) */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Organization Type (for category suggestions)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-2">
            This chooses which official category list (SNF / Behavioral Health / Home Health) the AI will suggest from. It is initialized from the selected org but can be adjusted for the suggestion step.
          </p>
          <Select value={selectedOrgType} onValueChange={(v) => setSelectedOrgType(v as OrgType)}>
            <SelectTrigger className="border-slate-700 bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="snf">SNF (Skilled Nursing Facility)</SelectItem>
              <SelectItem value="behavioral_health">Behavioral Health / Psych Facility</SelectItem>
              <SelectItem value="home_health">Home Health Agency</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-2 text-[10px] text-muted-foreground">
            After upload you will confirm one or more categories from this type&apos;s list. Multi-category assignment is supported.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Step 2 — Upload files</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cn(
              "flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
              dragging
                ? "border-amber-400 bg-amber-400/10"
                : "border-slate-600 hover:border-slate-500"
            )}
          >
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin text-amber-400" />
                <p className="mt-4 text-sm text-muted-foreground">
                  Uploading &amp; indexing for RAG (no lessons yet)…
                </p>
                <p className="mt-1 text-xs text-slate-500">After upload you will confirm categories before processing to lessons</p>
              </>
            ) : (
              <>
                <Upload className="h-10 w-10 text-slate-500" />
                <p className="mt-4 font-medium">Drag & drop files here</p>
                <p className="mt-1 text-xs text-slate-500">
                  PDF · Word · PowerPoint · Text · Images
                </p>
                <label className="mt-6">
                  <input
                    type="file"
                    multiple
                    accept={ACCEPTED}
                    className="hidden"
                    onChange={(e) =>
                      e.target.files && uploadFiles(e.target.files)
                    }
                  />
                  <span className={buttonVariants({ variant: "outline" })}>
                    Browse files
                  </span>
                </label>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="mt-6 space-y-2">
          <h3 className="font-medium text-sm text-muted-foreground">Upload results</h3>
          {results.map((r, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 text-sm",
                r.ok
                  ? "border-emerald-800 bg-emerald-950/50"
                  : "border-red-800 bg-red-950/50"
              )}
            >
              {r.ok ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <FileText className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-medium">{r.name}</p>
                <p className="text-muted-foreground whitespace-pre-wrap">{r.message}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* NEW: Mandatory category confirmation step (AI suggestion + multi-select + explicit confirm before lesson processing) */}
      {reviews.length > 0 && (
        <div className="mt-8">
          <Card className="border-accent/40">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Step 3 — Confirm categories (required before AI generates lessons)
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                The AI will suggest relevant categories from the chosen organization type&apos;s official list. You can select multiple. Nothing is processed into lessons/quizzes until you press Confirm.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews.map((rev, idx) => {
                const availableCats = getCategoriesForOrgType(rev.orgType);
                const isProcessing = rev.status === "suggesting" || rev.status === "confirming";
                return (
                  <div key={rev.materialId} className="rounded-lg border p-4 space-y-3 bg-muted/20">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium text-sm">{rev.fileName}</div>
                        <div className="text-[10px] text-muted-foreground">Material ID: {rev.materialId}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={rev.status === "done" ? "default" : rev.status === "confirming" || rev.status === "suggesting" ? "secondary" : "outline"} 
                          className="text-xs capitalize"
                        >
                          {rev.status === "confirming" ? "processing..." : rev.status}
                        </Badge>
                        {rev.lessonsCreated != null && rev.lessonsCreated > 0 && (
                          <Badge variant="secondary" className="text-xs">{rev.lessonsCreated} lessons</Badge>
                        )}
                        {(rev.status === "confirming" || rev.status === "suggesting") && (
                          <Loader2 className="h-3 w-3 animate-spin text-amber-400" />
                        )}
                      </div>
                    </div>

                    {/* Per-review type selector (allows overriding the page type for this doc) */}
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Label className="text-xs shrink-0">Type for suggestions:</Label>
                      <select
                        value={rev.orgType}
                        onChange={(e) => {
                          const newType = e.target.value as OrgType;
                          setReviews((prev) =>
                            prev.map((r, i) =>
                              i === idx
                                ? { ...r, orgType: newType, suggested: [], chosen: [], status: "pending", message: undefined }
                                : r
                            )
                          );
                        }}
                        className="border rounded px-2 py-1 text-xs bg-background"
                        disabled={isProcessing || rev.status === "done"}
                      >
                        <option value="snf">SNF</option>
                        <option value="behavioral_health">Behavioral Health</option>
                        <option value="home_health">Home Health</option>
                      </select>
                      <span className="text-[10px] text-muted-foreground">({availableCats.length} categories available)</span>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isProcessing || rev.status === "done" || !availableCats.length}
                        onClick={async () => {
                          setReviews((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, status: "suggesting" } : r))
                          );
                          try {
                            const res = await fetch("/api/admin/upload", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "suggest",
                                materialId: rev.materialId,
                                orgType: rev.orgType,
                              }),
                            });
                            const d = await res.json();
                            const sugg = (d.suggested || []) as string[];
                            setReviews((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      suggested: sugg,
                                      chosen: sugg.length ? [...sugg] : [...availableCats.slice(0, 1)],
                                      status: "ready",
                                      message: d.note,
                                    }
                                  : r
                              )
                            );
                          } catch (e) {
                            setReviews((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, status: "error", message: "Suggestion failed" } : r
                              )
                            );
                          }
                        }}
                      >
                        {rev.status === "suggesting" ? "Suggesting…" : "Suggest categories with AI"}
                      </Button>
                      {rev.suggested.length > 0 && (
                        <span className="text-xs self-center text-muted-foreground">AI suggested: {rev.suggested.join(", ")}</span>
                      )}
                    </div>

                    {/* Editable multi-select checkboxes for categories of the chosen type */}
                    {availableCats.length > 0 && rev.status !== "pending" && (
                      <div>
                        <Label className="text-xs mb-1 block">Assigned categories (multi-select OK — check all that apply)</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-sm border rounded p-2 bg-background max-h-40 overflow-auto">
                          {availableCats.map((cat) => {
                            const checked = rev.chosen.includes(cat);
                            return (
                              <label key={cat} className="flex items-center gap-2 cursor-pointer py-0.5">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={rev.status === "done" || isProcessing}
                                  onChange={(e) => {
                                    setReviews((prev) =>
                                      prev.map((r, i) => {
                                        if (i !== idx) return r;
                                        const nextChosen = e.target.checked
                                          ? [...r.chosen, cat]
                                          : r.chosen.filter((c) => c !== cat);
                                        return { ...r, chosen: nextChosen };
                                      })
                                    );
                                  }}
                                />
                                <span>{cat}</span>
                              </label>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Document will be tagged to these categories for staff filtering, progress tracking, and compliance views.</p>
                      </div>
                    )}

                    <div>
                      <Button
                        size="sm"
                        disabled={
                          rev.status === "done" ||
                          isProcessing ||
                          rev.chosen.length === 0
                        }
                        onClick={async () => {
                          setReviews((prev) =>
                            prev.map((r, i) => (i === idx ? { ...r, status: "confirming" } : r))
                          );
                          try {
                            const res = await fetch("/api/admin/upload", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                action: "confirm",
                                materialId: rev.materialId,
                                orgId: rev.orgId,
                                categories: rev.chosen,
                              }),
                            });
                            const d = await res.json();
                            setReviews((prev) =>
                              prev.map((r, i) =>
                                i === idx
                                  ? {
                                      ...r,
                                      status: d.ok !== false ? "done" : "error",
                                      message: d.message || (d.error ?? "Confirmed"),
                                      lessonsCreated: d.lessonsCreated,
                                    }
                                  : r
                              )
                            );
                            // If the server reported that the final material status write had problems,
                            // give a gentle hint. A page refresh on the org will pick up the real state.
                            if (d.materialUpdateOk === false) {
                              // We can optionally force a visual note, but the message already contains guidance.
                            }
                          } catch (e) {
                            setReviews((prev) =>
                              prev.map((r, i) =>
                                i === idx ? { ...r, status: "error", message: "Confirm failed (network or server error)" } : r
                              )
                            );
                          }
                        }}
                      >
                        {rev.status === "confirming" ? "Processing… (can take 15-60s)" : "Confirm categories & process into lessons"}
                      </Button>
                      {rev.message && (
                        <p className="text-xs mt-1 text-muted-foreground whitespace-pre-wrap">{rev.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function AdminUploadPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-2xl px-4 py-8 text-muted-foreground">
          Loading upload…
        </div>
      }
    >
      <AdminUploadPageContent />
    </Suspense>
  );
}
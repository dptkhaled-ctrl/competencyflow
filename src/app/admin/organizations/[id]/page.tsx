"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Shield,
  Trash2,
  Upload,
  Users,
} from "lucide-react";
import { useAppStore } from "@/lib/store/app-store";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { Organization, UploadedMaterial, User } from "@/lib/types";
import { getCategoriesForOrgType } from "@/lib/competency/domains";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface OrgDetail {
  organization: Organization;
  users: User[];
  uploadedMaterials: Array<
    Pick<
      UploadedMaterial,
      | "id"
      | "fileName"
      | "fileType"
      | "fileSize"
      | "status"
      | "lessonIds"
      | "uploadedAt"
      | "processedAt"
      | "errorMessage"
      | "assignedCategories"
    >
  >;
  lessons: Array<{ id: string; title: string; category: string }>;
  competencyDomains: Array<{ id: string; name: string }>;
  staffCount: number;
  managerCount: number;
}

// Categories now come from the single source of truth (domains.ts) so suggestions on upload stay in sync with compliance view.

export default function AdminOrgDetailPage() {
  const params = useParams();
  const orgId = params.id as string;
  const [detail, setDetail] = useState<OrgDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<
    OrgDetail["uploadedMaterials"][number] | null
  >(null);
  const [deleting, setDeleting] = useState(false);
  const [isDesigning, setIsDesigning] = useState(false);
  const [proposedLessons, setProposedLessons] = useState<any[] | null>(null);

  // Selection of materials for AI context in lesson designer
  const [selectedMaterialIds, setSelectedMaterialIds] = useState<Set<string>>(new Set());

  // For manual lesson editing
  const [editTarget, setEditTarget] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [viewTarget, setViewTarget] = useState<any>(null);


  // Moved up to satisfy Rules of Hooks (must be called unconditionally)
  const storeLessons = useAppStore((s) => s.lessons || []);
  const orgLessons = storeLessons.filter((l: any) => l.orgId === orgId);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/organizations/${orgId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) {
          setDetail(null);
        } else {
          setDetail(d);
        }
        setLoading(false);
      });
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  // Initialize material selection to all files when org data loads (user can uncheck specific ones)
  useEffect(() => {
    if (detail?.uploadedMaterials && detail.uploadedMaterials.length > 0 && selectedMaterialIds.size === 0) {
      setSelectedMaterialIds(new Set(detail.uploadedMaterials.map((m: any) => m.id)));
    }
  }, [detail?.uploadedMaterials?.length]);

  const confirmDelete = async (deleteLessons: boolean) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/admin/files/${deleteTarget.id}?deleteLessons=${deleteLessons}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const result = await res.json();
        alert(result.error ?? "Delete failed");
        return;
      }
      setDeleteTarget(null);
      load();
    } finally {
      setDeleting(false);
    }
  };

  // Manual lesson edit / remove (in addition to AI) - now with nice UI + server persistence
  const openEditLesson = (lesson: any) => {
    setEditTarget(lesson);
    // Structured form for easy minor edits (no more raw JSON for normal use)
    const currentSlides = Array.isArray(lesson.slides) ? lesson.slides : [];
    const currentQuiz = Array.isArray(lesson.quiz) && lesson.quiz.length > 0 ? lesson.quiz[0] : null;

    setEditForm({
      title: lesson.title || "",
      description: lesson.description || "",
      estimatedMinutes: lesson.estimatedMinutes || 2,
      category: lesson.category || "General",
      slides: currentSlides.length > 0 ? currentSlides : [{ title: "", body: "" }],
      // Quiz editor focuses on primary (first) question - common case
      quizPrompt: currentQuiz?.prompt || "",
      quizOptions: currentQuiz?.options?.length === 4 ? [...currentQuiz.options] : ["", "", "", ""],
      quizCorrectIndex: typeof currentQuiz?.correctIndex === "number" ? currentQuiz.correctIndex : 0,
      quizExplanation: currentQuiz?.explanation || "",
    });
  };

  const saveEditedLesson = async () => {
    if (!editTarget) return;

    // Rebuild clean lesson object from the friendly form
    const rebuiltSlides = (editForm.slides || []).map((s: any, i: number) => ({
      id: s.id || `slide-${Date.now()}-${i}`,
      title: s.title || `Part ${i + 1}`,
      body: s.body || "",
      durationSeconds: s.durationSeconds || 45,
    }));

    const rebuiltQuiz = [{
      id: "q1",
      prompt: editForm.quizPrompt || "What is the key point?",
      options: editForm.quizOptions || ["A", "B", "C", "D"],
      correctIndex: editForm.quizCorrectIndex ?? 0,
      explanation: editForm.quizExplanation || "",
    }];

    const updatedLesson = {
      ...editTarget,
      title: editForm.title,
      description: editForm.description,
      estimatedMinutes: editForm.estimatedMinutes,
      category: editForm.category,
      slides: rebuiltSlides,
      quiz: rebuiltQuiz,
    };

    try {
      const res = await fetch(`/api/admin/lessons/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedLesson),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert("Failed to save on server: " + (err.error || res.status));
        return;
      }
      // Also update local store immediately for admin list responsiveness
      const currentLessons = useAppStore.getState().lessons;
      const newLessons = currentLessons.map((l: any) => l.id === editTarget.id ? updatedLesson : l);
      useAppStore.setState({ lessons: newLessons });
    } catch (e: any) {
      alert("Save error: " + e.message);
      return;
    }

    setEditTarget(null);
    load();
  };

  const deleteLesson = async (lessonId: string) => {
    if (!confirm("Remove this lesson? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/admin/lessons/${lessonId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("Delete failed on server");
        return;
      }
      // local cleanup
      const currentLessons = useAppStore.getState().lessons;
      const newLessons = currentLessons.filter((l: any) => l.id !== lessonId);
      useAppStore.setState({ lessons: newLessons });
    } catch (e: any) {
      alert("Delete error: " + e.message);
      return;
    }
    load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading organization…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <p className="text-muted-foreground">Organization not found.</p>
        <Link
          href="/admin/organizations"
          className={cn(buttonVariants({ variant: "outline" }), "mt-4 border-input")}
        >
          Back to organizations
        </Link>
      </div>
    );
  }

  const { organization: org } = detail;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link
            href="/admin/organizations"
            className={cn(
              buttonVariants({ variant: "ghost", size: "icon" }),
              "text-muted-foreground shrink-0"
            )}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">{org.name}</h1>
              <Badge variant="outline">{org.orgType ?? "workplace"}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{org.industry}</p>
          </div>
        </div>
        <Link
          href={`/admin/upload?org=${org.id}`}
          className={buttonVariants({ className: "gap-2" })}
        >
          <Upload className="h-4 w-4" />
          Upload files
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          { label: "Staff", value: detail.staffCount },
          { label: "Managers", value: detail.managerCount },
          { label: "Uploaded files", value: detail.uploadedMaterials.length },
          { label: "Lessons", value: detail.lessons.length },
        ].map((stat) => (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="pt-4">
              <p className="text-2xl font-semibold tracking-tight">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Enhanced per-org file management - easy add/remove/customize */}
        <Card className="lg:col-span-2 shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-accent" />
                Documents &amp; Files for {org.name}
                <Badge variant="secondary" className="ml-2">
                  {detail.uploadedMaterials.length}
                </Badge>
              </CardTitle>
              <Link
                href={`/admin/upload?org=${org.id}`}
                className={buttonVariants({ size: "sm", variant: "outline", className: "gap-1.5" })}
              >
                <Upload className="h-3.5 w-3.5" /> Add files
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">Easily manage documents for RAG context (chatbot + AI Designer). Upload here, then use the AI Lesson Designer below to discuss exactly what lessons you want generated from the content. No auto-generation on upload.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.uploadedMaterials.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No documents yet for this organization.
                <Link href={`/admin/upload?org=${org.id}`} className="ml-1 underline">Upload your first policy or training material →</Link>
              </p>
            ) : (
              detail.uploadedMaterials.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-3 rounded-xl border p-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(m.uploadedAt).toLocaleDateString()} · {Math.round(m.fileSize / 1024)} KB · {m.fileType}
                    </p>
                    {m.assignedCategories && m.assignedCategories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.assignedCategories.map((c: string) => (
                          <Badge key={c} variant="outline" className="text-[10px] px-1 py-0">{c}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {m.lessonIds.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {m.lessonIds.length} lessons generated
                      </Badge>
                    )}
                    <Badge variant={m.status === "ready" ? "default" : "outline"} className="gap-1 text-xs">
                      {m.status === "ready" ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                      {m.status}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10"
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Team ({detail.users.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {detail.users.map((u) => (
              <div key={u.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium text-sm">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant="outline" className="capitalize text-xs">{u.role}</Badge>
              </div>
            ))}
            <Link href="/admin/database" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-2 w-full")}>
              Manage users &amp; database
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BookOpen className="h-4 w-4" />
              Generated training
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Facility-specific topics</p>
              <div className="flex flex-wrap gap-1.5">
                {detail.competencyDomains.length ? detail.competencyDomains.map((d) => (
                  <Badge key={d.id} variant="secondary" className="text-xs">{d.name}</Badge>
                )) : <span className="text-sm text-muted-foreground">None yet</span>}
              </div>

              {/* Compliance File Coverage for CDPH and Joint Commission — now also respects multi-category document assignments from the upload confirmation flow */}
              <p className="mt-4 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Compliance File Coverage (CDPH & Joint Commission)</p>
              <div className="text-xs space-y-1">
                {detail && getCategoriesForOrgType(detail.organization?.orgType || "snf").map((cat) => {
                  const hasLesson = (detail.lessons || []).some((l: any) => l.category === cat);
                  const hasDoc = (detail.uploadedMaterials || []).some((m: any) =>
                    Array.isArray(m.assignedCategories) && m.assignedCategories.includes(cat)
                  );
                  const status = hasLesson
                    ? "✅ Lesson coverage"
                    : hasDoc
                    ? "📄 Document tagged (lessons pending)"
                    : "❌ No coverage yet (upload + confirm category)";
                  const color = hasLesson ? "text-green-600" : hasDoc ? "text-amber-600" : "text-red-600";
                  return (
                    <div key={cat} className="flex justify-between border-b pb-0.5">
                      <span>{cat}</span>
                      <span className={color}>{status}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Admin view: Documents must be uploaded + have their categories confirmed in the upload flow for proper tagging and lesson generation.</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Lessons ({detail.lessons.length})</p>
              {detail.lessons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No lessons generated yet.</p>
              ) : (
                <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
                  {detail.lessons.slice(0, 8).map((l) => <p key={l.id} className="truncate text-foreground/80">{l.title}</p>)}
                  {detail.lessons.length > 8 && <p className="text-xs text-muted-foreground">+{detail.lessons.length - 8} more</p>}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Editable lessons list - manual control in addition to AI */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-4 w-4" />
            Lessons for {org.name} (edit or remove anytime)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {orgLessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">No lessons yet. Use upload or the AI Designer below.</p>
          ) : (
            orgLessons.map((l: any) => (
              <div key={l.id} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{l.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{l.description}</p>
                  <div className="flex gap-1 mt-1">
                    <Badge variant="outline" className="text-xs">{l.estimatedMinutes || 2}min</Badge>
                    <Badge variant="secondary" className="text-xs">{l.category || "General"}</Badge>
                    {l.isAutoGenerated && <Badge className="text-xs">AI</Badge>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => setViewTarget(l)}>View full</Button>
                  <Button size="sm" variant="outline" onClick={() => openEditLesson(l)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteLesson(l.id)}>Remove</Button>
                </div>
              </div>
            ))
          )}

          {orgLessons.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="mt-2 w-full"
              onClick={async () => {
                try {
                  const res = await fetch("/api/admin/assign-all-lessons", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ orgId }),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    alert(data.message || "Lessons re-assigned to current staff.");
                    load();
                  } else {
                    alert(data.error || "Failed to re-assign");
                  }
                } catch (e) {
                  alert("Failed to re-assign lessons");
                }
              }}
            >
              Re-assign all current lessons to existing staff
            </Button>
          )}
        </CardContent>
      </Card>

      {/* NEW: Advanced but easy Admin AI Chat for custom lesson generation */}
      <Card className="mt-6 border border-accent/20 bg-gradient-to-br from-white to-accent/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent" /> AI Lesson Designer (Admin only)
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            The AI lesson designer focuses <strong>only</strong> on the exact text + the checked files below. Lessons will be categorized under the same category as the checked source files (e.g. if you check "Behavioral De-escalation" files, lessons get that category or closest match from them). Be explicit with the number if desired.
          </p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <textarea 
              id="admin-ai-instructions"
              className="w-full min-h-[110px] rounded-xl border p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 bg-white"
              placeholder="Write your exact instructions here. The AI will follow only this text (plus checked files for context). Be specific with the count if you want more than a few: e.g. 'Create exactly 5 lessons on ...' or 'Produce 3 lessons covering...'."
              defaultValue=""
            />

            {/* Simple material selector by category */}
            {detail && detail.uploadedMaterials && detail.uploadedMaterials.length > 0 && (() => {
              const orgType = detail.organization?.orgType || "snf";
              const cats = getCategoriesForOrgType(orgType);
              const allMatIds = detail.uploadedMaterials.map((m: any) => m.id);
              const isAllSelected = selectedMaterialIds.size === allMatIds.length;
              const isNoneSelected = selectedMaterialIds.size === 0;

              return (
                <div className="border rounded-xl p-3 bg-white text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-medium">Limit to specific files (optional)</span>
                      <span className="ml-2 text-muted-foreground">— only checked files will be used as context; lessons will use their categories</span>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSelectedMaterialIds(new Set(allMatIds))}>Check all</Button>
                      <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => setSelectedMaterialIds(new Set())}>Uncheck all</Button>
                    </div>
                  </div>

                  <div className="max-h-48 overflow-auto space-y-2 pr-1">
                    {cats.map((cat: string) => {
                      const catFiles = detail.uploadedMaterials.filter((m: any) =>
                        Array.isArray(m.assignedCategories) && m.assignedCategories.includes(cat)
                      );
                      if (catFiles.length === 0) return null;

                      const selectedInCat = catFiles.filter((f: any) => selectedMaterialIds.has(f.id)).length;
                      const allInCat = selectedInCat === catFiles.length;
                      const someInCat = selectedInCat > 0 && !allInCat;

                      return (
                        <div key={cat} className="pl-1">
                          <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                            <input
                              type="checkbox"
                              className="accent-accent"
                              checked={allInCat}
                              ref={(el) => { if (el) el.indeterminate = someInCat; }}
                              onChange={(e) => {
                                const newSet = new Set(selectedMaterialIds);
                                catFiles.forEach((f: any) => {
                                  if (e.target.checked) newSet.add(f.id);
                                  else newSet.delete(f.id);
                                });
                                setSelectedMaterialIds(newSet);
                              }}
                            />
                            <span>{cat}</span>
                            <span className="text-[10px] text-muted-foreground">({selectedInCat}/{catFiles.length})</span>
                          </label>

                          <div className="ml-5 mt-0.5 space-y-0.5">
                            {catFiles.map((file: any) => (
                              <label key={file.id} className="flex items-center gap-1.5 cursor-pointer text-muted-foreground">
                                <input
                                  type="checkbox"
                                  className="accent-accent"
                                  checked={selectedMaterialIds.has(file.id)}
                                  onChange={() => {
                                    const newSet = new Set(selectedMaterialIds);
                                    if (newSet.has(file.id)) newSet.delete(file.id);
                                    else newSet.add(file.id);
                                    setSelectedMaterialIds(newSet);
                                  }}
                                />
                                <span className="truncate">{file.fileName}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="text-[10px] text-muted-foreground">
                    {isNoneSelected || isAllSelected
                      ? (isAllSelected ? "Using all uploaded files for context" : "No files selected — will use all available")
                      : `${selectedMaterialIds.size} file(s) selected for context`}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <Button 
                onClick={async (e) => {
                  const ta = document.getElementById('admin-ai-instructions') as HTMLTextAreaElement;
                  const instructions = ta?.value?.trim();
                  if (!instructions) {
                    alert("Please enter instructions for the AI (e.g. what lessons to create or focus on).");
                    return;
                  }

                  setIsDesigning(true);
                  const btn = e.currentTarget as HTMLButtonElement;
                  btn.disabled = true;

                  try {
                    const selectedArray = selectedMaterialIds.size > 0 
                      ? Array.from(selectedMaterialIds) 
                      : undefined;

                    const res = await fetch("/api/admin/design-lessons", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ 
                        orgId, 
                        instructions, 
                        selectedMaterialIds: selectedArray 
                      }),
                    });
                    const data = await res.json();

                    if (data.error) {
                      alert("Error: " + data.error);
                      return;
                    }

                    if (data.lessons && data.lessons.length > 0) {
                      setProposedLessons(data.lessons);
                      ta.value = "";
                    } else {
                      alert("No lessons generated. Try different instructions or ensure OpenAI key has credits and materials uploaded.");
                    }
                  } catch (e: any) {
                    alert("Failed to generate: " + (e.message || "Network or API error. Check console."));
                  } finally {
                    btn.disabled = false;
                    setIsDesigning(false);
                  }
                }}
                className="flex-1"
                disabled={isDesigning}
              >
                {isDesigning ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" /> Generating lessons from your instructions…
                  </span>
                ) : (
                  "Generate lessons from my instructions"
                )}
              </Button>
              <Button variant="outline" onClick={() => {
                const ta = document.getElementById('admin-ai-instructions') as HTMLTextAreaElement;
                if (ta) ta.value = "Create exactly 5 lessons on immediate post-fall response using only the checked files. Focus exclusively on the actions a frontline CNA must take in the first 60 seconds after a fall. Use short numbered steps for each. Include one realistic scenario-based quiz question per lesson. Ignore anything not directly actionable by staff.";
              }}>
                Load example
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => {
                  const ta = document.getElementById('admin-ai-instructions') as HTMLTextAreaElement;
                  if (ta) ta.value = "Generate exactly 4 high-quality lessons only for the highest-priority categories that currently have no lessons. Use only content strongly present in the uploaded files. Make every lesson practical and action-first. Each must have a clear scenario-based quiz. Do not invent details or cover low-priority items.";
                }}
              >
                Fill coverage gaps
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Pure instructions + only the checked files above are sent as context to the AI</p>
          </div>
        </CardContent>
      </Card>

      {/* Preview / Clarify step for AI changes - safe before apply, supports modify/replace/delete intent */}
      {proposedLessons && (
        <Card className="border-2 border-accent mt-4">
          <CardHeader>
            <CardTitle className="text-base">Review AI's Proposed Changes</CardTitle>
            <p className="text-sm text-muted-foreground">
              The AI analyzed your instructions and the current files. It proposes these tailored lessons.
              Review before applying. You can replace all existing or just add these.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-h-48 overflow-auto space-y-2 text-sm border rounded p-3 bg-muted/30">
              {proposedLessons.map((l, i) => (
                <div key={i} className="flex justify-between">
                  <span>{l.title}</span>
                  <Badge variant="outline" className="text-xs">{l.category || "Custom"}</Badge>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/apply-designed-lessons", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orgId, lessons: proposedLessons, mode: "add" }),
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) {
                      alert("Server apply failed: " + (data.error || "unknown"));
                      return;
                    }
                    const store = useAppStore.getState();
                    if (store.mergePlatformData && data.lessons?.length) {
                      store.mergePlatformData({ lessons: data.lessons });
                    }
                    setDetail((prev) => prev ? {
                      ...prev,
                      lessons: [...(prev.lessons || []), ...proposedLessons.map((l: any) => ({ id: l.id, title: l.title, category: l.category || "Custom" }))]
                    } : prev);
                    alert(data.message || "Changes applied. New tailored lessons added and auto-assigned to staff. They will now appear in the Learn section.");
                    setProposedLessons(null);
                    load();
                  } catch (e: any) {
                    alert("Apply failed: " + (e.message || e));
                  }
                }}
              >
                Apply — Add these new lessons
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/admin/apply-designed-lessons", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ orgId, lessons: proposedLessons, mode: "replace" }),
                    });
                    const data = await res.json();
                    if (!res.ok || data.error) {
                      alert("Server replace failed: " + (data.error || "unknown"));
                      return;
                    }
                    const store = useAppStore.getState();
                    if (store.mergePlatformData && data.lessons?.length) {
                      // For replace the server already filtered; we can merge what was applied
                      store.mergePlatformData({ lessons: data.lessons });
                    }
                    setDetail((prev) => prev ? {
                      ...prev,
                      lessons: proposedLessons.map((l: any) => ({ id: l.id, title: l.title, category: l.category || "Custom" }))
                    } : prev);
                    alert(data.message || "Replaced previous lessons with the AI-tailored set. New lessons auto-assigned to staff.");
                    setProposedLessons(null);
                    load();
                  } catch (e: any) {
                    alert("Replace failed: " + (e.message || e));
                  }
                }}
              >
                Replace ALL previous lessons with these
              </Button>
              <Button variant="outline" onClick={() => setProposedLessons(null)}>
                Cancel / Edit instructions
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: To have AI delete specific files or lessons, include in instructions e.g. "delete the old hand hygiene file and replace with new emphasis on X". Use the trash icons above for manual deletes too.
            </p>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              {deleteTarget?.fileName}
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
                  disabled={deleting}
                  onClick={() => confirmDelete(false)}
                >
                  Delete file only
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

      {/* View Full Lesson Details (separated boxes - what staff actually see) */}
      <Dialog open={!!viewTarget} onOpenChange={() => setViewTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lesson Details — {viewTarget?.title}</DialogTitle>
            <DialogDescription>Exact content delivered to staff (separated simple boxes).</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-auto pr-1">
            {(viewTarget?.slides || []).map((slide: any, idx: number) => (
              <div key={idx} className="rounded-2xl border bg-white p-4">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-indigo-600 mb-1">Slide {idx + 1}</div>
                <div className="font-semibold mb-2">{slide.title}</div>
                <div className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">{slide.body}</div>
              </div>
            ))}
            {/* Quiz box */}
            <div className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-4">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-orange-600 mb-1">Quiz</div>
              {(viewTarget?.quiz || []).map((q: any, qi: number) => (
                <div key={qi} className="space-y-2">
                  <p className="font-medium">{q.prompt}</p>
                  <ul className="text-sm space-y-1">
                    {(q.options || []).map((opt: string, oi: number) => (
                      <li key={oi} className={oi === q.correctIndex ? "font-semibold text-emerald-700" : ""}>
                        {String.fromCharCode(65 + oi)}. {opt} {oi === q.correctIndex && "✓"}
                      </li>
                    ))}
                  </ul>
                  {q.explanation && <p className="text-xs text-muted-foreground mt-2">Explanation: {q.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
            <Button onClick={() => { const l = viewTarget; setViewTarget(null); openEditLesson(l); }}>Edit this lesson</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lesson Dialog - friendly form with separated editors for minor custom changes */}
      <Dialog open={!!editTarget} onOpenChange={() => setEditTarget(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Lesson</DialogTitle>
            <DialogDescription>
              Make minor changes to title, slides, or quiz. For bigger rewrites use the AI Designer above.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-1 max-h-[65vh] overflow-auto pr-2">
            {/* Basic meta */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label className="text-xs">Title</Label>
                <Input value={editForm.title || ""} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Description</Label>
                <Textarea value={editForm.description || ""} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Minutes</Label>
                  <Input type="number" value={editForm.estimatedMinutes || 2} onChange={(e) => setEditForm({ ...editForm, estimatedMinutes: parseInt(e.target.value) || 2 })} />
                </div>
                <div>
                  <Label className="text-xs">Category</Label>
                  <Input value={editForm.category || ""} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
                </div>
              </div>
            </div>

            {/* Slides as editable separated boxes */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs font-semibold">Slides (separated content boxes)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setEditForm({
                    ...editForm,
                    slides: [...(editForm.slides || []), { title: "", body: "" }]
                  })}
                >
                  + Add slide
                </Button>
              </div>
              <div className="space-y-3">
                {(editForm.slides || []).map((s: any, i: number) => (
                  <div key={i} className="rounded-xl border p-3 bg-slate-50/50">
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-[10px] font-medium text-muted-foreground">Slide {i + 1}</span>
                      <Button type="button" size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => {
                        const next = (editForm.slides || []).filter((_: any, idx: number) => idx !== i);
                        setEditForm({ ...editForm, slides: next.length ? next : [{ title: "", body: "" }] });
                      }}>Remove</Button>
                    </div>
                    <Input
                      className="mb-2"
                      placeholder="Slide title"
                      value={s.title || ""}
                      onChange={(e) => {
                        const next = [...(editForm.slides || [])];
                        next[i] = { ...next[i], title: e.target.value };
                        setEditForm({ ...editForm, slides: next });
                      }}
                    />
                    <Textarea
                      placeholder="Slide body (keep short & clear)"
                      value={s.body || ""}
                      onChange={(e) => {
                        const next = [...(editForm.slides || [])];
                        next[i] = { ...next[i], body: e.target.value };
                        setEditForm({ ...editForm, slides: next });
                      }}
                      rows={3}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Quiz as simple editor box */}
            <div className="rounded-xl border p-4 bg-orange-50/30 border-orange-100">
              <Label className="text-xs font-semibold text-orange-800">Quiz (one question box)</Label>
              <div className="mt-2 space-y-2">
                <div>
                  <Label className="text-[10px]">Question</Label>
                  <Textarea value={editForm.quizPrompt || ""} onChange={(e) => setEditForm({ ...editForm, quizPrompt: e.target.value })} rows={2} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[0,1,2,3].map((oi) => (
                    <div key={oi}>
                      <Label className="text-[10px]">{String.fromCharCode(65 + oi)}</Label>
                      <Input
                        value={(editForm.quizOptions || [])[oi] || ""}
                        onChange={(e) => {
                          const opts = [...(editForm.quizOptions || ["","","",""])];
                          opts[oi] = e.target.value;
                          setEditForm({ ...editForm, quizOptions: opts });
                        }}
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <Label className="text-[10px]">Correct answer</Label>
                  <select
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={editForm.quizCorrectIndex ?? 0}
                    onChange={(e) => setEditForm({ ...editForm, quizCorrectIndex: parseInt(e.target.value) })}
                  >
                    {[0,1,2,3].map((i) => <option key={i} value={i}>{String.fromCharCode(65 + i)}</option>)}
                  </select>
                </div>
                <div>
                  <Label className="text-[10px]">Explanation (shown after answer)</Label>
                  <Textarea value={editForm.quizExplanation || ""} onChange={(e) => setEditForm({ ...editForm, quizExplanation: e.target.value })} rows={2} />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEditedLesson}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
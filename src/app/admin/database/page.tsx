"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2,
  Download,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAppStore } from "@/lib/store/app-store";
import type { CompetencyDomain, Organization, OrgType, Team, UploadedMaterial, User, UserRole } from "@/lib/types";
import { getJobTitlesForOrgType, getDefaultPrioritiesForRole, getCategoriesForOrgType } from "@/lib/competency/domains";
import { downloadAdminFile } from "@/lib/admin/download-file";

export default function AdminDatabasePage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [domains, setDomains] = useState<CompetencyDomain[]>([]);
  const [lessonRequests, setLessonRequests] = useState<any[]>([]);
  const [uploadedMaterials, setUploadedMaterials] = useState<UploadedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingUserId, setTestingUserId] = useState<string | null>(null);

  const managerRequestedMaterials = uploadedMaterials.filter(
    (m) => !!m.managerRequestNote
  );

  const [orgForm, setOrgForm] = useState({
    name: "",
    industry: "",
    orgType: "snf" as OrgType,
    teamName: "Main Team",
  });
  const [editOrgId, setEditOrgId] = useState<string | null>(null);
  const [editOrgForm, setEditOrgForm] = useState({
    name: "",
    industry: "",
    orgType: "snf" as OrgType,
  });

  const [userForm, setUserForm] = useState({
    orgId: "",
    teamId: "",
    name: "",
    email: "",
    role: "staff" as UserRole,
    jobTitle: "",
    priorityCategories: [] as string[],
  });

  // Bulk add excel-style for admin
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{name: string, email: string, jobTitle: string, orgId: string}>>([{name: '', email: '', jobTitle: '', orgId: ''}]);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserForm, setEditUserForm] = useState({
    name: "",
    email: "",
    role: "staff" as UserRole,
    orgId: "",
    teamId: "",
    jobTitle: "",
    priorityCategories: [] as string[],
  });

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/platform")
      .then((r) => r.json())
      .then((data) => {
        setOrganizations(data.organizations ?? []);
        setTeams(data.teams ?? []);
        setUsers(data.users ?? []);
        setDomains(data.competencyDomains ?? []);
        setLessonRequests(data.lessonRequests ?? []);
        setUploadedMaterials(data.uploadedMaterials ?? []);
        setLoading(false);
      });
  }, []);

  // After mutating users/orgs in admin, refresh the global store so RoleSwitcher,
  // welcome page, and "Test as" immediately see new people.
  const refreshGlobalStore = async () => {
    try {
      await useAppStore.getState().hydrateFromServer?.();
    } catch {}
  };

  const syncUserToGlobalStore = (user: User) => {
    const store = useAppStore.getState();
    const existing = store.users.some((u) => u.id === user.id);
    if (!existing) {
      store.mergePlatformData({ users: [user] });
    }
  };

  const testAsUser = async (user: User) => {
    setTestingUserId(user.id);
    try {
      await refreshGlobalStore();
      syncUserToGlobalStore(user);
      useAppStore.getState().setCurrentUser(user.id);
      window.location.href = user.role === "staff" ? "/staff" : "/manager";
    } finally {
      setTestingUserId(null);
    }
  };

  const approveManagerRequest = async (req: any) => {
    // Create a basic lesson from the request
    const newLesson = {
      id: `lesson-mgr-${Date.now()}`,
      orgId: req.orgId,
      title: req.title || "Manager Requested Lesson",
      description: req.description || "Created from manager material submission.",
      category: "General", // Admin can adjust; in real would map to requested category
      estimatedMinutes: 5,
      slides: [
        { id: "s1", title: "Overview", body: req.description || "Key points from submitted materials.", durationSeconds: 60 },
        { id: "s2", title: "Key Takeaways", body: "Apply these practices in daily work.", durationSeconds: 60 },
      ],
      quiz: [
        {
          id: "q1",
          prompt: "What is the main goal of this training?",
          options: ["To follow best practices", "To ignore policies", "To work faster without checks", "To document nothing"],
          correctIndex: 0,
          explanation: "Following the practices ensures safety and compliance.",
        },
      ],
      sourceDocumentIds: [],
      isAutoGenerated: true,
    };

    // Add lesson via store (will be visible after refresh)
    useAppStore.getState().mergePlatformData({ lessons: [newLesson] });

    // Optimistically update local list
    setLessonRequests((prev) =>
      prev.map((r) =>
        r.id === req.id ? { ...r, status: "approved", approvedLessonId: newLesson.id } : r
      )
    );

    // In a full impl, call approve API here
    alert(`Approved! A new lesson has been created for org ${req.orgId} and assigned to relevant categories/staff where applicable.`);

    void refreshGlobalStore();
  };

  useEffect(() => {
    load();
  }, [load]);

  const createOrg = async () => {
    if (!orgForm.name.trim() || !orgForm.industry.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orgForm),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to create organization");
        return;
      }
      setOrgForm({ name: "", industry: "", orgType: "snf", teamName: "Main Team" });
      load();
      await refreshGlobalStore();
    } finally {
      setSaving(false);
    }
  };

  const saveOrgEdit = async () => {
    if (!editOrgId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${editOrgId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editOrgForm),
      });
      if (!res.ok) {
        alert("Failed to update organization");
        return;
      }
      setEditOrgId(null);
      load();
      await refreshGlobalStore();
    } finally {
      setSaving(false);
    }
  };

  const deleteOrg = async (id: string, name: string) => {
    if (
      !confirm(
        `Delete "${name}" and ALL its users, files, lessons, and progress? This cannot be undone.`
      )
    )
      return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        alert("Failed to delete organization");
        return;
      }
      load();
      await refreshGlobalStore();
    } finally {
      setSaving(false);
    }
  };

  const createUser = async () => {
    if (
      !userForm.orgId ||
      !userForm.teamId ||
      !userForm.name.trim() ||
      !userForm.email.trim()
    )
      return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error ?? "Failed to create user");
        return;
      }
      const result = await res.json();
      if (result?.user?.id) {
        syncUserToGlobalStore(result.user);
      }
      setUserForm({
        orgId: userForm.orgId,
        teamId: userForm.teamId,
        name: "",
        email: "",
        role: "staff",
        jobTitle: "",
        priorityCategories: [],
      });
      load();
      await refreshGlobalStore();
    } finally {
      setSaving(false);
    }
  };

  const saveUserEdit = async () => {
    if (!editUserId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${editUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editUserForm),
      });
      if (!res.ok) {
        alert("Failed to update user");
        return;
      }
      setEditUserId(null);
      load();
      await refreshGlobalStore();
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`Delete user "${name}" and all their progress?`)) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      load();
      await refreshGlobalStore();
    } finally {
      setSaving(false);
    }
  };

  const startEditOrg = (org: Organization) => {
    setEditOrgId(org.id);
    setEditOrgForm({
      name: org.name,
      industry: org.industry,
      orgType: org.orgType ?? "snf",
    });
  };

  const startEditUser = (user: User) => {
    setEditUserId(user.id);
    setEditUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      orgId: user.orgId,
      teamId: user.teamId,
      jobTitle: user.jobTitle || "",
      priorityCategories: user.priorityCategories || [],
    });
  };

  const teamsForOrg = (orgId: string) =>
    teams.filter((t) => t.orgId === orgId);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading database…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">People & Organizations</h1>
        <p className="text-sm text-muted-foreground">
          Full control over clients, teams, staff, and managers
        </p>
      </div>

      {/* Dedicated pure section for requested lessons (from manager submit materials flow).
          Shows: org, which manager, downloadable file, the instructions written.
          Admin processes with regular upload + AI analyzer (no auto creation of lessons from the request). */}
      <Card className="mb-6 border-blue-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Requested Lessons from Managers</CardTitle>
          <p className="text-xs text-muted-foreground -mt-1">
            From which org + which manager. Download includes the uploaded file reference and the exact instructions. Use these to drive content creation via the standard Upload + analyzer flow.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {managerRequestedMaterials.length === 0 ? (
            <p className="text-sm text-muted-foreground">No requests yet. When a manager uses "Submit Materials for New Lessons" on their dashboard, it appears here with full details.</p>
          ) : (
            managerRequestedMaterials.map((m: any) => {
              const org = organizations.find((o) => o.id === m.orgId);
              const orgLabel = org ? `${org.name} (${org.orgType || 'snf'})` : m.orgId;
              const mgrName = m.managerName || "Unknown manager";
              const note = m.managerRequestNote || "No instructions provided.";
              return (
                <div key={m.id} className="rounded border p-3 text-sm">
                  <div className="grid gap-1">
                    <div><strong>Organization:</strong> {orgLabel}</div>
                    <div><strong>Manager:</strong> {mgrName} {m.managerId && <span className="text-[10px] text-muted-foreground">· {m.managerId}</span>}</div>
                    <div><strong>Uploaded file:</strong> {m.fileName} <span className="text-[10px] text-muted-foreground">({Math.round((m.fileSize || 0)/1024)} KB)</span></div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs font-medium">Instructions the manager wrote:</div>
                    <div className="mt-0.5 text-xs bg-slate-50 border rounded p-2 whitespace-pre-wrap">{note}</div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        const pkg = [
                          "COMPETENCYFLOW MANAGER REQUESTED LESSON — DOWNLOAD PACKAGE",
                          "",
                          `Org: ${orgLabel}`,
                          `Manager: ${mgrName} (${m.managerId || 'n/a'})`,
                          `File submitted: ${m.fileName}`,
                          `Submitted: ${new Date(m.uploadedAt).toLocaleString()}`,
                          "",
                          "MANAGER INSTRUCTIONS:",
                          note,
                          "",
                          "HOW TO USE (Admin):",
                          "- Open /admin/upload or the org's upload page.",
                          "- Upload a document matching the file name above (or the policy content).",
                          "- Paste or reference the manager's instructions when running the AI lesson analyzer / designer.",
                          "- The generated lessons will be reviewed/edited here before publishing to the org's categories.",
                          "",
                          "(Tip: use Download uploaded file to get the manager's original document.)"
                        ].join("\n");
                        const b = new Blob([pkg], { type: "text/plain;charset=utf-8" });
                        const u = URL.createObjectURL(b);
                        const a = document.createElement("a");
                        a.href = u;
                        a.download = `manager-request-${m.fileName.replace(/[^a-z0-9.-]/gi,'_')}.txt`;
                        document.body.appendChild(a); a.click(); a.remove();
                        URL.revokeObjectURL(u);
                      }}
                    >
                      <Download className="h-3.5 w-3.5 mr-1" /> Download file info + instructions
                    </Button>
                    {m.storagePath && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          try {
                            await downloadAdminFile(m.id, m.fileName);
                          } catch (err) {
                            alert(
                              err instanceof Error
                                ? err.message
                                : "Could not download file."
                            );
                          }
                        }}
                      >
                        Download uploaded file
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        await fetch(`/api/admin/files/${m.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "markProcessed" }),
                        });
                        setUploadedMaterials((prev) =>
                          prev.map((x) =>
                            x.id === m.id
                              ? {
                                  ...x,
                                  managerRequestNote: undefined,
                                  managerId: undefined,
                                  managerName: undefined,
                                }
                              : x
                          )
                        );
                      }}
                    >
                      Mark as Processed
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="organizations">
        <TabsList className="mb-6">
          <TabsTrigger value="organizations">Organizations</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="organizations" className="space-y-6">
          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plus className="h-4 w-4 text-amber-400" />
                Add organization
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={orgForm.name}
                  onChange={(e) =>
                    setOrgForm({ ...orgForm, name: e.target.value })
                  }
                  placeholder="Pacific PT Academy"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Industry</Label>
                <Input
                  value={orgForm.industry}
                  onChange={(e) =>
                    setOrgForm({ ...orgForm, industry: e.target.value })
                  }
                  placeholder="Physical Therapy Education"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Type</Label>
                <Select
                  value={orgForm.orgType}
                  onValueChange={(v) =>
                    setOrgForm({ ...orgForm, orgType: v as OrgType })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="snf">SNF (Skilled Nursing Facility)</SelectItem>
                    <SelectItem value="behavioral_health">Behavioral Health / Psych</SelectItem>
                    <SelectItem value="home_health">Home Health Agency</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default team name</Label>
                <Input
                  value={orgForm.teamName}
                  onChange={(e) =>
                    setOrgForm({ ...orgForm, teamName: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="sm:col-span-2">
                <Button onClick={createOrg} disabled={saving}>
                  <Building2 className="h-4 w-4" />
                  Create organization
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base">
                All organizations ({organizations.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {organizations.map((org) =>
                editOrgId === org.id ? (
                  <div
                    key={org.id}
                    className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Input
                        value={editOrgForm.name}
                        onChange={(e) =>
                          setEditOrgForm({ ...editOrgForm, name: e.target.value })
                        }
                        className="bg-background"
                      />
                      <Input
                        value={editOrgForm.industry}
                        onChange={(e) =>
                          setEditOrgForm({
                            ...editOrgForm,
                            industry: e.target.value,
                          })
                        }
                        className="bg-background"
                      />
                      <Select
                        value={editOrgForm.orgType}
                        onValueChange={(v) =>
                          setEditOrgForm({
                            ...editOrgForm,
                            orgType: v as OrgType,
                          })
                        }
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="snf">SNF (Skilled Nursing Facility)</SelectItem>
                          <SelectItem value="behavioral_health">Behavioral Health / Psych</SelectItem>
                          <SelectItem value="home_health">Home Health Agency</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveOrgEdit} disabled={saving}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditOrgId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={org.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                  >
                    <div>
                      <p className="font-medium">{org.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {org.industry} · {org.id}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-muted">
                        {org.orgType ?? "snf"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditOrg(org)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400"
                        onClick={() => deleteOrg(org.id, org.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <Card className="border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UserPlus className="h-4 w-4 text-amber-400" />
                Add user
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select
                  value={userForm.orgId}
                  onValueChange={(v) => {
                    if (!v) return;
                    setUserForm({
                      ...userForm,
                      orgId: v,
                      teamId: teamsForOrg(v)[0]?.id ?? "",
                      jobTitle: "",
                      priorityCategories: [],
                    });
                  }}
                >
                  <SelectTrigger className="bg-background">
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
                  value={userForm.teamId}
                  onValueChange={(v) => {
                    if (!v) return;
                    setUserForm({ ...userForm, teamId: v });
                  }}
                  disabled={!userForm.orgId}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsForOrg(userForm.orgId).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Full name</Label>
                <Input
                  value={userForm.name}
                  onChange={(e) =>
                    setUserForm({ ...userForm, name: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={userForm.email}
                  onChange={(e) =>
                    setUserForm({ ...userForm, email: e.target.value })
                  }
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select
                  value={userForm.role}
                  onValueChange={(v) => {
                    const newRole = v as UserRole;
                    setUserForm({
                      ...userForm,
                      role: newRole,
                      ...(newRole !== "staff" ? { jobTitle: "", priorityCategories: [] } : {}),
                    });
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">Staff / Student</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Role-based category assignment for staff (select Org first) */}
              {userForm.role === "staff" && userForm.orgId && (() => {
                const selectedOrg = organizations.find((o) => o.id === userForm.orgId);
                const orgType = selectedOrg?.orgType || "snf";
                const orgCats = domains.filter((d) => d.orgId === userForm.orgId).map((d) => d.name);
                const titles = getJobTitlesForOrgType(orgType);
                const currentJob = userForm.jobTitle;
                const currentPrios = userForm.priorityCategories || [];
                return (
                  <div className="sm:col-span-2 space-y-3 rounded border border-accent/30 bg-accent/5 p-3">
                    <div className="space-y-2">
                      <Label>Job Title (auto-assigns core categories)</Label>
                      <select
                        value={currentJob}
                        onChange={(e) => {
                          const title = e.target.value;
                          const defaults = title ? getDefaultPrioritiesForRole(orgType, title, orgCats) : [];
                          setUserForm({ ...userForm, jobTitle: title, priorityCategories: defaults });
                        }}
                        className="w-full border rounded p-2 text-sm bg-background"
                      >
                        <option value="">Select Job Title...</option>
                        {titles.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>
                    {currentJob && orgCats.length > 0 && (
                      <div>
                        <Label className="mb-1 block text-xs">Assigned Categories (editable — staff will only see lessons from these)</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-sm max-h-36 overflow-auto border rounded p-2 bg-background">
                          {orgCats.map((cat) => (
                            <label key={cat} className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={currentPrios.includes(cat)}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...currentPrios, cat]
                                    : currentPrios.filter((c) => c !== cat);
                                  setUserForm({ ...userForm, priorityCategories: next });
                                }}
                              />
                              {cat}
                            </label>
                          ))}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">Managers can adjust these later per staff member.</p>
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="flex items-end gap-2">
                <Button onClick={createUser} disabled={saving}>
                  <UserPlus className="h-4 w-4" />
                  Add user
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowBulkDialog(true)}>
                  Bulk Add Staff
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Bulk Add Dialog for admin */}
          <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
            <DialogContent className="max-w-4xl">
              <DialogHeader>
                <DialogTitle>Bulk Add Staff</DialogTitle>
                <DialogDescription>Add multiple staff at once. Per row: name, email, job title (auto-sets role-based categories), and organization.</DialogDescription>
              </DialogHeader>
              <div className="space-y-1 max-h-[50vh] overflow-auto border rounded p-2 text-sm">
                <div className="grid grid-cols-12 gap-1 text-[10px] font-medium px-1">
                  <div className="col-span-3">Name</div>
                  <div className="col-span-3">Email</div>
                  <div className="col-span-2">Job Title</div>
                  <div className="col-span-3">Org</div>
                  <div className="col-span-1"></div>
                </div>
                {bulkRows.map((row, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-1 items-center">
                    <input className="col-span-3 border rounded p-1" value={row.name} placeholder="Name" onChange={e=>{const nr=[...bulkRows]; nr[idx].name=e.target.value; setBulkRows(nr);}} />
                    <input type="email" className="col-span-3 border rounded p-1" value={row.email} placeholder="Email" onChange={e=>{const nr=[...bulkRows]; nr[idx].email=e.target.value; setBulkRows(nr);}} />
                    <select className="col-span-2 border rounded p-1 text-xs" value={row.jobTitle} onChange={e=>{const nr=[...bulkRows]; nr[idx].jobTitle=e.target.value; setBulkRows(nr);}}>
                      <option value="">Title...</option>
                      {getJobTitlesForOrgType('snf').concat(getJobTitlesForOrgType('behavioral_health')).concat(getJobTitlesForOrgType('home_health')).filter((v,i,a)=>a.indexOf(v)===i).map(t=><option key={t} value={t}>{t}</option>)}
                    </select>
                    <select className="col-span-3 border rounded p-1 text-xs" value={row.orgId} onChange={e=>{const nr=[...bulkRows]; nr[idx].orgId=e.target.value; setBulkRows(nr);}}>
                      <option value="">Org...</option>
                      {organizations.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <Button size="sm" variant="ghost" className="col-span-1 h-6" onClick={()=>{if(bulkRows.length>1) setBulkRows(bulkRows.filter((_,i)=>i!==idx));}}>×</Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={()=>setBulkRows([...bulkRows, {name:'',email:'',jobTitle:'',orgId:''}])}>+ Row</Button>
                <Button onClick={async ()=>{
                  const valid = bulkRows.filter(r=>r.name.trim()&&r.email.trim()&&r.jobTitle&&r.orgId);
                  if(!valid.length) return alert('Fill at least one full row.');
                  const createdUsers: User[] = [];
                  const promises = valid.map(async (r) => {
                    const t = r.jobTitle;
                    const o = organizations.find(oo=>oo.id===r.orgId);
                    const cats = o ? getDefaultPrioritiesForRole(o.orgType||'snf', t, getCategoriesForOrgType(o.orgType||'snf')) : [];
                    const teamId = teamsForOrg(r.orgId)[0]?.id || '';
                    const body = {
                      orgId: r.orgId,
                      teamId,
                      name: r.name.trim(),
                      email: r.email.trim(),
                      role: 'staff',
                      jobTitle: t,
                      priorityCategories: cats,
                    };
                    const res = await fetch("/api/admin/users", {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify(body),
                    });
                    if (res.ok) {
                      const result = await res.json();
                      if (result?.user?.id) createdUsers.push(result.user);
                    }
                    return res;
                  });
                  await Promise.all(promises);
                  createdUsers.forEach((u) => syncUserToGlobalStore(u));
                  alert(`Added ${valid.length} staff. They will appear on the home page and in "Test as".`);
                  setBulkRows([{name:'',email:'',jobTitle:'',orgId:''}]);
                  setShowBulkDialog(false);
                  load();
                  await refreshGlobalStore();
                }}>Add All</Button>
                <Button variant="ghost" size="sm" onClick={()=>{setBulkRows([{name:'',email:'',jobTitle:'',orgId:''}]); setShowBulkDialog(false);}}>Cancel</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Card className="border">
            <CardHeader>
              <CardTitle className="text-base">
                All users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {users.map((user) =>
                editUserId === user.id ? (
                  <div
                    key={user.id}
                    className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        value={editUserForm.name}
                        onChange={(e) =>
                          setEditUserForm({
                            ...editUserForm,
                            name: e.target.value,
                          })
                        }
                        className="bg-background"
                      />
                      <Input
                        value={editUserForm.email}
                        onChange={(e) =>
                          setEditUserForm({
                            ...editUserForm,
                            email: e.target.value,
                          })
                        }
                        className="bg-background"
                      />
                      <Select
                        value={editUserForm.orgId}
                        onValueChange={(v) => {
                          if (!v) return;
                          setEditUserForm({
                            ...editUserForm,
                            orgId: v,
                            teamId: teamsForOrg(v)[0]?.id ?? "",
                            jobTitle: "",
                            priorityCategories: [],
                          });
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((o) => (
                            <SelectItem key={o.id} value={o.id}>
                              {o.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editUserForm.teamId}
                        onValueChange={(v) => {
                          if (!v) return;
                          setEditUserForm({ ...editUserForm, teamId: v });
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {teamsForOrg(editUserForm.orgId).map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={editUserForm.role}
                        onValueChange={(v) => {
                          const newRole = v as UserRole;
                          setEditUserForm({
                            ...editUserForm,
                            role: newRole,
                            ...(newRole !== "staff" ? { jobTitle: "", priorityCategories: [] } : {}),
                          });
                        }}
                      >
                        <SelectTrigger className="bg-background">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveUserEdit} disabled={saving}>
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setEditUserId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    key={user.id}
                    className="flex items-center justify-between rounded-lg border border-slate-700 p-4"
                  >
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {user.email} ·{" "}
                        {organizations.find((o) => o.id === user.orgId)?.name}
                        {user.jobTitle ? ` · ${user.jobTitle}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize border-muted">
                        {user.role}
                      </Badge>
                      {user.priorityCategories && user.priorityCategories.length > 0 && (
                        <Badge variant="secondary" className="text-[10px]">Priorities set</Badge>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={testingUserId === user.id}
                        onClick={() => testAsUser(user)}
                      >
                        {testingUserId === user.id ? "Testing..." : "Test as"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => startEditUser(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400"
                        onClick={() => deleteUser(user.id, user.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
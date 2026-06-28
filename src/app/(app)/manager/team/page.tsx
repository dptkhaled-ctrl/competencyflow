"use client";

import { useState } from "react";
import { TeamMemberRow } from "@/components/manager/team-member-row";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildTeamMemberStatuses } from "@/lib/analytics/team";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser, useCurrentOrg, useOrgStaff } from "@/lib/store/hooks";
import { getJobTitlesForOrgType, getDefaultPrioritiesForRole } from "@/lib/competency/domains";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type { LessonAssignment, TeamMemberStatus, User } from "@/lib/types";

export default function ManagerTeamPage() {
  const user = useCurrentUser();
  const org = useCurrentOrg();
  const staff = useOrgStaff();
  const assignments = useAppStore((s) => s.assignments);
  const progress = useAppStore((s) => s.progress);
  const streaks = useAppStore((s) => s.streaks);
  const lessons = useAppStore((s) => s.lessons);
  const storeTeams = useAppStore((s) => s.teams);
  const addStaff = useAppStore((s) => s.addStaff);
  const removeStaff = useAppStore((s) => s.removeStaff);
  const updateStaffPriorities = useAppStore((s) => s.updateStaffPriorities);
  const mergePlatformData = useAppStore((s) => s.mergePlatformData);

  const team = storeTeams.find((t) => t.id === user.teamId)
    || storeTeams.find((t) => t.orgId === user.orgId)
    || { id: "fallback", name: "Main Team", orgId: user.orgId };

  const orgDomains = (useAppStore((s) => s.competencyDomains) || []).filter((d) => d.orgId === user.orgId);
  const orgCategories = orgDomains.map((d) => d.name);
  const jobTitles = org ? getJobTitlesForOrgType(org.orgType || "snf") : [];

  const teamStatuses = buildTeamMemberStatuses(
    staff,
    assignments,
    progress,
    streaks,
    lessons
  );

  // Add staff uses the multi-row experience (the only add flow now)
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkRows, setBulkRows] = useState<Array<{name: string, email: string, jobTitle: string}>>([{name: '', email: '', jobTitle: ''}]);

  const [selectedStaff, setSelectedStaff] = useState<TeamMemberStatus | null>(null);
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedInterval, setSelectedInterval] = useState(90);

  const openStaffDetail = (member: TeamMemberStatus) => {
    setSelectedStaff(member);
    setSelectedPriorities(member.user.priorityCategories || orgCategories);
    setSelectedInterval(member.user.refresherIntervalDays || 90);
  };

  const savePriorities = async () => {
    if (!selectedStaff) return;
    try {
      await fetch("/api/manager/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "updatePriorities",
          userId: selectedStaff.user.id,
          priorityCategories: selectedPriorities,
        }),
      });
    } catch {}
    updateStaffPriorities(selectedStaff.user.id, selectedPriorities);
    const currentUsers = useAppStore.getState().users;
    const updatedUser = currentUsers.find((u) => u.id === selectedStaff.user.id);
    if (updatedUser) {
      mergePlatformData({ users: [ { ...updatedUser, priorityCategories: selectedPriorities } ] });
    }
    setSelectedStaff({ ...selectedStaff, user: { ...selectedStaff.user, priorityCategories: selectedPriorities } });
  };

  const assignMatchingPriorities = async () => {
    if (!selectedStaff || selectedPriorities.length === 0) return;
    const relevantLessons = lessons.filter(
      (l) =>
        l.orgId === user.orgId && selectedPriorities.includes(l.category || "")
    );
    if (relevantLessons.length === 0) {
      alert("No lessons match the selected priorities yet.");
      return;
    }

    let assigned = 0;
    const allNewAssignments: LessonAssignment[] = [];

    for (const lesson of relevantLessons) {
      try {
        const res = await fetch("/api/manager/assign-refresher", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orgId: user.orgId,
            teamId: user.teamId,
            managerId: user.id,
            mode: "existing",
            lessonId: lesson.id,
            userIds: [selectedStaff.user.id],
            category: lesson.category,
          }),
        });
        const data = await res.json();
        if (res.ok && data.assignments?.length) {
          assigned += data.assignments.length;
          allNewAssignments.push(...data.assignments);
        }
      } catch {
        // continue with remaining lessons
      }
    }

    if (assigned > 0) {
      mergePlatformData({
        assignments: [
          ...useAppStore.getState().assignments,
          ...allNewAssignments,
        ],
      });
      alert(`Assigned ${assigned} priority lessons to ${selectedStaff.user.name}.`);
    } else {
      alert("All priority lessons already assigned.");
    }
  };

  // (old single-add handler fully removed — only the multi-row Add Staff dialog remains)

  const handleRemoveStaff = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team? This will clear their progress and assignments.`)) return;
    try {
      await fetch(`/api/manager/users?userId=${userId}`, { method: "DELETE" });
    } catch {}
    removeStaff(userId);
    if (selectedStaff?.user.id === userId) {
      setSelectedStaff(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team</h1>
          <p className="text-sm text-muted-foreground">{team.name} — completion &amp; competency gaps</p>
        </div>
        <Button onClick={() => setShowBulkDialog(true)}>Invite staff</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Staff members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamStatuses.map((member) => (
            <div key={member.user.id} className="flex items-center gap-2">
              <div className="flex-1" onClick={() => openStaffDetail(member)}>
                <TeamMemberRow member={member} />
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveStaff(member.user.id, member.user.name);
                }}
              >
                Remove
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Single-add dialog removed per request — only the multi-row add experience is used now */}

      {/* Add Staff Dialog (multi-row) */}
      <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>
              Each person receives a professional activation email with a secure magic link.
              They must use that link to join — accounts are invite-only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto border rounded p-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium px-1">
              <div className="col-span-4">Name</div>
              <div className="col-span-4">Email</div>
              <div className="col-span-3">Job Title</div>
              <div className="col-span-1"></div>
            </div>
            {bulkRows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <input 
                  className="col-span-4 border rounded p-1 text-sm" 
                  value={row.name} 
                  placeholder="Full name"
                  onChange={e => {
                    const val = e.target.value;
                    const newRows = [...bulkRows];
                    newRows[idx].name = val;
                    setBulkRows(newRows);
                    // Auto-add new row when typing in the last row (keyboard-friendly)
                    if (idx === bulkRows.length - 1 && val.trim() !== '') {
                      setBulkRows([...newRows, {name: '', email: '', jobTitle: newRows[idx].jobTitle || ''}]);
                    }
                  }} 
                />
                <input 
                  type="email" 
                  className="col-span-4 border rounded p-1 text-sm" 
                  value={row.email} 
                  placeholder="email@org.com"
                  onChange={e => {
                    const val = e.target.value;
                    const newRows = [...bulkRows];
                    newRows[idx].email = val;
                    setBulkRows(newRows);
                    // Auto-add new row when typing in the last row (keyboard-friendly)
                    if (idx === bulkRows.length - 1 && val.trim() !== '') {
                      setBulkRows([...newRows, {name: newRows[idx].name || '', email: '', jobTitle: newRows[idx].jobTitle || ''}]);
                    }
                  }} 
                />
                <select 
                  className="col-span-3 border rounded p-1 text-sm"
                  value={row.jobTitle}
                  onChange={e => {
                    const newRows = [...bulkRows];
                    newRows[idx].jobTitle = e.target.value;
                    setBulkRows(newRows);
                  }}
                >
                  <option value="">Select title...</option>
                  {jobTitles.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <Button size="sm" variant="ghost" className="col-span-1 h-7" onClick={() => {
                  if (bulkRows.length > 1) setBulkRows(bulkRows.filter((_,i) => i !== idx));
                }}>×</Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button 
              onClick={async () => {
                const valid = bulkRows.filter(r => r.name.trim() && r.email.trim() && r.jobTitle);
                if (valid.length === 0) return alert("Add at least one complete row (name, email, title).");
                let sent = 0;
                const manualLinks: string[] = [];
                const errors: string[] = [];
                for (const row of valid) {
                  try {
                    const res = await fetch("/api/manager/invites", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        name: row.name.trim(),
                        email: row.email.trim(),
                        jobTitle: row.jobTitle,
                      }),
                    });
                    const text = await res.text();
                    const data = text ? JSON.parse(text) : {};
                    if (res.ok) {
                      sent += 1;
                      if (!data.emailSent && (data.magicLink || data.inviteLink)) {
                        manualLinks.push(
                          `${row.email}: ${data.magicLink ?? data.inviteLink}`
                        );
                      }
                    } else {
                      const link = data.magicLink ?? data.inviteLink;
                      if (link) manualLinks.push(`${row.email}: ${link}`);
                      errors.push(`${row.email}: ${data.error ?? "failed"}`);
                    }
                  } catch {
                    errors.push(`${row.email}: network error`);
                  }
                }
                let msg =
                  sent > 0
                    ? manualLinks.length > 0
                      ? `Created ${sent} invite(s). Email limit reached — copy the links below and send them yourself.`
                      : `Sent ${sent} invite email${sent > 1 ? "s" : ""}. Staff will appear after they activate their account.`
                    : "Could not send invites.";
                if (manualLinks.length) {
                  msg += `\n\nCopy and send these links manually:\n${manualLinks.join("\n")}`;
                }
                if (errors.length) msg += `\n\n${errors.join("\n")}`;
                alert(msg);
                setBulkRows([{name:'', email:'', jobTitle:''}]);
                setShowBulkDialog(false);
              }}
            >
              Send invite emails
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setBulkRows([{name:'', email:'', jobTitle:''}]); setShowBulkDialog(false); }}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff Detail Dialog with Priorities */}
      <Dialog open={!!selectedStaff} onOpenChange={() => setSelectedStaff(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Staff Detail: {selectedStaff?.user.name}</DialogTitle>
            <DialogDescription>
              {selectedStaff?.user.email} • Role: {selectedStaff?.user.role} • Team: {team.name}
            </DialogDescription>
          </DialogHeader>

          {selectedStaff && (
            <div className="space-y-4">
              {/* Individual Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                {/* Streak display removed per v0.1 (practical focus, no gamification mentions) */}
                <div>Overall Completion: <strong>{selectedStaff.completionRate}%</strong></div>
                <div>At Risk: <strong>{selectedStaff.atRisk ? "Yes" : "No"}</strong></div>
                <div>Gap Areas: {selectedStaff.gapAreas.length ? selectedStaff.gapAreas.join(", ") : "None"}</div>
              </div>

              {/* Refresher Interval - manager sets the cycle for this staff */}
              <div>
                <h4 className="font-medium mb-1">Refresher Interval (days)</h4>
                <div className="flex gap-2">
                  <input 
                    type="number" 
                    className="border rounded p-1 w-24 text-sm" 
                    value={selectedInterval} 
                    onChange={(e) => setSelectedInterval(parseInt(e.target.value) || 90)}
                    min="7"
                  />
                  <Button size="sm" onClick={async () => {
                    try {
                      await fetch("/api/manager/users", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          action: "updateRefresherInterval",
                          userId: selectedStaff.user.id,
                          refresherIntervalDays: selectedInterval,
                        }),
                      });
                    } catch {}
                    const updated = { ...selectedStaff.user, refresherIntervalDays: selectedInterval };
                    mergePlatformData({ users: [updated] });
                    setSelectedStaff({ ...selectedStaff, user: updated });
                    alert("Interval saved. This will affect the color progress bar for this staff.");
                  }}>Save</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Manager-controlled cycle. Lower = more frequent refreshers.</p>
              </div>

              {/* Assigned Lessons for this staff */}
              <div>
                <h4 className="font-medium mb-2">Assigned Lessons</h4>
                <div className="max-h-32 overflow-auto text-sm space-y-1 border rounded p-2">
                  {assignments
                    .filter((a) => a.userId === selectedStaff.user.id)
                    .map((a) => {
                      const l = lessons.find((l) => l.id === a.lessonId);
                      return l ? <div key={a.lessonId}>• {l.title} ({l.category})</div> : null;
                    })}
                  {assignments.filter((a) => a.userId === selectedStaff.user.id).length === 0 && <div className="text-muted-foreground">No lessons assigned yet.</div>}
                </div>
              </div>

              {/* Modify Priorities */}
              <div>
                <h4 className="font-medium mb-2">Priorities for Assignment</h4>
                <p className="text-xs text-muted-foreground mb-2">Select categories to prioritize for this staff's training assignments. This affects recommendations and quick-assign.</p>
                <div className="grid grid-cols-2 gap-2 text-sm max-h-40 overflow-auto border rounded p-2">
                  {orgCategories.map((cat) => (
                    <label key={cat} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPriorities.includes(cat)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPriorities([...selectedPriorities, cat]);
                          } else {
                            setSelectedPriorities(selectedPriorities.filter((c) => c !== cat));
                          }
                        }}
                      />
                      {cat}
                    </label>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <Button size="sm" onClick={savePriorities}>Save Priorities</Button>
                  <Button size="sm" variant="outline" onClick={assignMatchingPriorities} disabled={selectedPriorities.length === 0}>
                    Assign lessons matching priorities
                  </Button>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedStaff(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
"use client";

import {
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Mic,
  MicOff,
  Send,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/app-store";
import { useMemo, useState, useRef } from "react";
import {
  useCurrentOrg,
  useCurrentUser,
  useSavedPolicyAnswers,
  useUserLessons,
} from "@/lib/store/hooks";
import { isRefresherRotationEnabled } from "@/lib/competency/domains";
import { buildRefresherCycleSnapshot } from "@/lib/competency/refresher-cycle";
import { StaffLessonsSection } from "@/components/staff/staff-lessons-section";
import { StaffDueRefresherCard } from "@/components/staff/staff-due-refresher-card";
import type { ChatMessage, Lesson } from "@/lib/types";

export function StaffDashboard() {
  const user = useCurrentUser();
  const org = useCurrentOrg();
  const lessons = useUserLessons();
  const progress = useAppStore((s) => s.progress);
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const allLessons = useAppStore((s) => s.lessons);
  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const savePolicyAnswer = useAppStore((s) => s.savePolicyAnswer);
  const removePolicyAnswer = useAppStore((s) => s.removePolicyAnswer);
  const savedAnswers = useSavedPolicyAnswers();
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);
  const [expandedSavedId, setExpandedSavedId] = useState<string | null>(null);
  const [savedSectionOpen, setSavedSectionOpen] = useState(true);

  const rotationEnabled = isRefresherRotationEnabled(org);
  const cycleSnapshot = useMemo(
    () =>
      rotationEnabled
        ? buildRefresherCycleSnapshot(user, competencyDomains, allLessons, progress)
        : null,
    [rotationEnabled, user, competencyDomains, allLessons, progress]
  );

  const completedLessons = progress.filter(
    (p) => p.userId === user.id && p.status === "completed"
  ).length;
  const totalLessons = lessons.length;
  const lessonProgress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  // Embedded Ask Policy chat — on screen, regular chat + mic, always visible in one view
  const [askMessages, setAskMessages] = useState<Array<{ role: "user" | "assistant"; content: string; citations?: any[] }>>([]);
  const [askInput, setAskInput] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const isAnswerSaved = (question: string, answer: string) =>
    savedAnswers.some((s) => s.question === question && s.answer === answer);

  const handleSaveAnswer = (
    question: string,
    answer: string,
    citations?: Array<{ documentTitle: string; section: string; excerpt?: string }>
  ) => {
    if (isAnswerSaved(question, answer)) return;
    savePolicyAnswer(user.id, { question, answer, citations });
  };

  const handleAsk = async (text?: string) => {
    const question = (text || askInput).trim();
    if (!question) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: question,
      createdAt: new Date().toISOString(),
    };
    addChatMessage(user.id, userMsg);

    const newUserMsg = { role: "user" as const, content: question };
    setAskMessages((prev) => [...prev, newUserMsg]);
    setAskInput("");
    setAskLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: user.orgId, question }),
      });
      const data = await res.json();
      const answer = data.answer || "Sorry, I couldn't find anything on that right now.";
      const citations = data.citations || [];
      const assistantMsg = {
        role: "assistant" as const,
        content: answer,
        citations,
      };
      const loggedAssistant: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: answer,
        citations,
        createdAt: new Date().toISOString(),
      };
      addChatMessage(user.id, loggedAssistant);
      setAskMessages((prev) => [...prev, assistantMsg]);
    } catch {
      const fallback = "The Ask Policy assistant hit a snag. Try rephrasing?";
      addChatMessage(user.id, {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: fallback,
        createdAt: new Date().toISOString(),
      });
      setAskMessages((prev) => [...prev, { role: "assistant", content: fallback }]);
    } finally {
      setAskLoading(false);
    }
  };

  const toggleVoice = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice not supported in this browser.");
      return;
    }
    if (!recognitionRef.current) {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (ev: any) => {
        const transcript = ev.results[0][0].transcript;
        setListening(false);
        handleAsk(transcript);
      };
      rec.onerror = () => setListening(false);
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    }
    if (listening) {
      try { recognitionRef.current.stop(); } catch {}
      setListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setListening(true);
      } catch (e) {
        setListening(false);
      }
    }
  };

  const clearAskChat = () => {
    setAskMessages([]);
    setAskInput("");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setListening(false);
  };

  return (
    <div className="space-y-4 pb-4 max-w-full">
      {/* Simple header with progress - mobile first, one view */}
      <div className="rounded-2xl bg-white border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{org?.name ?? "Your organization"}</p>
            <h1 className="text-xl font-semibold">Hey, {user.name.split(" ")[0]} 👋</h1>
          </div>
          <div className="text-right text-sm">
            <div className="font-medium">{lessonProgress}% complete</div>
            <div className="text-[10px] text-muted-foreground">{completedLessons}/{totalLessons} lessons</div>
          </div>
        </div>
        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
          <div className="h-2 bg-indigo-600 transition-all" style={{ width: `${lessonProgress}%` }} />
        </div>
      </div>

      {/* Refresher cycle progress by color (per-category intervals set by manager).
          Bar = average freshness % across your categories (starts near 100% after completing the refresher for a category, slowly decreases over the interval if you don't do the next one).
          Colors: red <25%, orange 25-50%, yellow 50-75%, green >75%.
          The bar acts as the "loading / coming soon" visual for when the next cycle for each category is due.
          After you complete the current set for your categories, the cycles repeat independently.
       */}
      {rotationEnabled && <StaffDueRefresherCard onStart={setSelectedLesson} />}

      {rotationEnabled && (
      <div className="rounded-2xl border bg-white p-4">
        {!cycleSnapshot || cycleSnapshot.categories.length === 0 ? (
          <p className="text-sm">No priority categories set for refreshers yet.</p>
        ) : (() => {
          const active = cycleSnapshot.currentDue ?? cycleSnapshot.nextUp;
          const fresh = active?.freshnessPercent ?? 100;
          let barColor = "bg-green-500";
          let statusMsg = "You're all caught up.";
          if (cycleSnapshot.currentDue) {
            barColor = "bg-indigo-500";
            statusMsg = `${cycleSnapshot.currentDue.category} is ready — tap Start above.`;
          } else if (fresh < 50) {
            barColor = "bg-yellow-500";
            statusMsg = `${cycleSnapshot.nextUp?.category ?? "Next topic"} coming up soon.`;
          }
          return (
            <>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium">Rotation</span>
                <span className="text-xs text-muted-foreground">
                  {cycleSnapshot.categories.length} topics · ~{cycleSnapshot.cadenceDays}d apart
                </span>
              </div>
              <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-3 rounded-full transition-all ${barColor}`}
                  style={{ width: `${fresh}%` }}
                />
              </div>
              <p className="text-sm mt-2">{statusMsg}</p>
              <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">
                One topic at a time: {cycleSnapshot.rotationLabel}
              </p>
            </>
          );
        })()}
      </div>
      )}

      {/* Ask Policy chat - moved above the lessons list */}
      <div className="rounded-2xl border bg-white p-4 flex flex-col" style={{ minHeight: '280px' }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-indigo-600" />
            <h3 className="font-semibold">Ask Policy</h3>
          </div>
          {askMessages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAskChat} className="text-xs h-7 px-2">
              Clear
            </Button>
          )}
        </div>

        {savedAnswers.length > 0 && (
          <div className="mb-2 rounded-xl border border-indigo-100 bg-indigo-50/40">
            <button
              type="button"
              onClick={() => setSavedSectionOpen((open) => !open)}
              className="flex w-full items-center justify-between px-3 py-2 text-left"
            >
              <span className="text-xs font-medium text-indigo-900">
                Saved answers ({savedAnswers.length})
              </span>
              {savedSectionOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-indigo-600" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-indigo-600" />
              )}
            </button>
            {savedSectionOpen && (
              <div className="max-h-[160px] space-y-1.5 overflow-y-auto border-t border-indigo-100 px-2 py-2">
                {savedAnswers.map((entry) => {
                  const expanded = expandedSavedId === entry.id;
                  return (
                    <div key={entry.id} className="rounded-lg border bg-white p-2 text-xs">
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSavedId(expanded ? null : entry.id)
                        }
                        className="w-full text-left font-medium leading-snug"
                      >
                        {entry.question}
                      </button>
                      {expanded && (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {entry.answer}
                          </p>
                          {entry.citations && entry.citations.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              Based on {entry.citations[0].documentTitle}
                              {entry.citations.length > 1
                                ? ` +${entry.citations.length - 1} more`
                                : ""}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => handleAsk(entry.question)}
                              disabled={askLoading}
                            >
                              Ask again
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-[11px] text-red-600 hover:text-red-700"
                              onClick={() => {
                                removePolicyAnswer(user.id, entry.id);
                                if (expandedSavedId === entry.id) {
                                  setExpandedSavedId(null);
                                }
                              }}
                            >
                              <Trash2 className="mr-1 h-3 w-3" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-[140px] max-h-[220px] overflow-y-auto space-y-2 mb-2 p-2 bg-slate-50 rounded text-sm border">
          {askMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Ask anything about your policies. Answers are instant and grounded in your org's materials.</p>
          ) : (
            askMessages.map((msg, idx) => {
              const question =
                msg.role === "assistant" && idx > 0
                  ? askMessages[idx - 1]?.content
                  : undefined;
              const saved =
                question && msg.role === "assistant"
                  ? isAnswerSaved(question, msg.content)
                  : false;

              return (
                <div
                  key={idx}
                  className={cn(
                    "p-2 rounded",
                    msg.role === "user" ? "bg-indigo-100 ml-6" : "bg-white mr-6 border"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[10px] uppercase tracking-widest mb-0.5 text-muted-foreground">
                      {msg.role}
                    </div>
                    {msg.role === "assistant" && question && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-6 px-1.5 text-[10px] shrink-0",
                          saved && "text-indigo-600"
                        )}
                        onClick={() =>
                          handleSaveAnswer(question, msg.content, msg.citations)
                        }
                        disabled={saved}
                      >
                        {saved ? (
                          <>
                            <BookmarkCheck className="mr-1 h-3 w-3" />
                            Saved
                          </>
                        ) : (
                          <>
                            <Bookmark className="mr-1 h-3 w-3" />
                            Save
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex gap-2">
          <input
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !askLoading && handleAsk()}
            placeholder="Type your question... (e.g. hand hygiene rules)"
            className="flex-1 border rounded-xl px-3 py-2 text-sm"
            disabled={askLoading || listening}
          />
          <Button onClick={() => handleAsk()} disabled={askLoading || !askInput.trim() || listening} size="icon" className="shrink-0">
            {askLoading ? <span>...</span> : <Send className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            size="icon"
            variant={listening ? "default" : "outline"}
            onClick={toggleVoice}
            disabled={askLoading}
            className={listening ? "bg-red-600 hover:bg-red-700" : ""}
          >
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-1">
          On-screen chat • Tap mic to speak • Save answers for later • Private to you
        </p>
      </div>

      <StaffLessonsSection
        selectedLesson={selectedLesson}
        onSelectLesson={setSelectedLesson}
      />
    </div>
  );
}
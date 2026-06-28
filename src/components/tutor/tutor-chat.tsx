"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProgressChip } from "@/components/tutor/progress-chip";
import { QuizCard } from "@/components/tutor/quiz-card";
import { StaffDemoSwitcher } from "@/components/tutor/staff-demo-switcher";
import { TeachCard } from "@/components/tutor/teach-card";
import { TutorTopBar } from "@/components/tutor/tutor-top-bar";
import { getUserAvgMastery } from "@/lib/competency/mastery";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser } from "@/lib/store/hooks";
import type { CompetencyRecord, TutorCard, TutorMessage } from "@/lib/types";

const SUGGESTIONS = [
  "Teach me something new",
  "Review my weakest topic",
];

function resolveSessionId(messages: TutorMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].sessionId) return messages[i].sessionId;
  }
  return null;
}

function findPendingQuiz(messages: TutorMessage[]): TutorCard | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" || !m.cards) continue;
    const quiz = m.cards.find((c) => c.type === "quiz" && !c.answered);
    if (quiz) return quiz;
  }
  return null;
}

function parseAnswerInput(text: string): number | null {
  const t = text.trim().toUpperCase();
  if (/^[A-D]$/.test(t)) return t.charCodeAt(0) - 65;
  if (/^[1-4]$/.test(t)) return Number(t) - 1;
  return null;
}

function quizRevealKey(messageId: string, teachId: string) {
  return `${messageId}:${teachId}`;
}

export function TutorChat() {
  const user = useCurrentUser();
  const competencyDomains = useAppStore((s) => s.competencyDomains);
  const competencyRecords = useAppStore((s) => s.competencyRecords);
  const setCompetencyData = useAppStore((s) => s.setCompetencyData);
  const mergeUserXp = useAppStore((s) => s.mergeUserXp);
  const mergeAssessmentEvent = useAppStore((s) => s.mergeAssessmentEvent);

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [records, setRecords] = useState<CompetencyRecord[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [assessing, setAssessing] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [revealedQuizKeys, setRevealedQuizKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const sessionStarted = useRef(false);
  const loadingRef = useRef(false);
  const sendRef = useRef<(text: string, mode?: "session_start" | "continue" | "ask") => Promise<void>>(async () => {});
  const bottomRef = useRef<HTMLDivElement>(null);

  const avgMastery = getUserAvgMastery(
    records.length ? records : competencyRecords,
    competencyDomains,
    user.id,
    user.orgId
  );

  const scrollDown = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
  };

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/tutor/chat?userId=${user.id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const loaded: TutorMessage[] = data.messages ?? [];
    setMessages(loaded);
    const recs: CompetencyRecord[] = data.records ?? [];
    setRecords(recs);
    setCompetencyData({ records: recs });

    const sid = resolveSessionId(loaded);
    if (sid) setSessionId(sid);

    const revealed = new Set<string>();
    for (const m of loaded) {
      if (!m.cards) continue;
      const teach = m.cards.find((c) => c.type === "teach");
      const quiz = m.cards.find((c) => c.type === "quiz");
      if (teach && (quiz?.answered || revealed.has(quizRevealKey(m.id, teach.id)))) {
        revealed.add(quizRevealKey(m.id, teach.id));
      }
      if (teach && quiz && !quiz.answered) {
        revealed.add(quizRevealKey(m.id, teach.id));
      }
    }
    setRevealedQuizKeys(revealed);
    return loaded;
  }, [user.id, setCompetencyData]);

  const send = useCallback(
    async (text: string, mode?: "session_start" | "continue" | "ask") => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/tutor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, message: text, mode }),
        });
        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? "Something went wrong.");
          return;
        }

        setSessionId(data.sessionId);
        setMessages(data.messages ?? []);
        if (data.records) {
          setRecords(data.records);
          setCompetencyData({ records: data.records });
        }
        if (data.userXp) mergeUserXp(data.userXp);
      } finally {
        loadingRef.current = false;
        setLoading(false);
        scrollDown();
      }
    },
    [user.id, setCompetencyData, mergeUserXp]
  );

  sendRef.current = send;

  const handleQuizAnswer = async (card: TutorCard, selectedIndex: number) => {
    if (card.answered) return;

    const activeSession =
      sessionId ?? resolveSessionId(messages) ?? `session-${user.id}-${Date.now()}`;
    if (!sessionId) setSessionId(activeSession);

    if (!card.domainId) {
      setError("This quiz is missing a topic tag. Try 'Teach me something new'.");
      return;
    }

    if (!card.options?.length || card.correctIndex === undefined) {
      setError("This quiz isn't set up correctly. Try 'Teach me something new'.");
      return;
    }

    setAssessing(card.id);
    setError(null);

    try {
      const res = await fetch("/api/tutor/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          sessionId: activeSession,
          cardId: card.id,
          question: card.question,
          selectedIndex,
          correctIndex: card.correctIndex,
          domainId: card.domainId,
          lessonId: card.lessonId,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Could not save your answer. Try again.");
        return;
      }

      setMessages((prev) =>
        prev.map((m) => ({
          ...m,
          cards: m.cards?.map((c) =>
            c.id === card.id
              ? {
                  ...c,
                  answered: true,
                  selectedIndex,
                  wasCorrect: data.correct,
                  explanation: data.correct
                    ? c.explanation
                    : `Correct answer: ${String.fromCharCode(65 + (c.correctIndex ?? 0))}. ${c.explanation ?? ""}`,
                }
              : c
          ),
        }))
      );

      if (data.record) {
        const nextRecords = [...records];
        const idx = nextRecords.findIndex(
          (r) => r.userId === user.id && r.domainId === card.domainId
        );
        if (idx >= 0) nextRecords[idx] = data.record;
        else nextRecords.push(data.record);
        setRecords(nextRecords);
        setCompetencyData({ records: nextRecords });
      }

      if (data.userXp) mergeUserXp(data.userXp);
      if (data.assessmentEvent) mergeAssessmentEvent(data.assessmentEvent);

      setMessages((prev) => [
        ...prev,
        {
          id: `tmsg-prog-${Date.now()}`,
          sessionId: activeSession,
          userId: user.id,
          role: "assistant",
          content: data.correct ? "Great job!" : "Keep going — you're learning.",
          cards: [
            {
              id: `prog-${Date.now()}`,
              type: "progress",
              domainName: data.domainName,
              masteryBefore: data.masteryBefore,
              masteryAfter: data.masteryAfter,
              xpEarned: data.xpEarned,
            },
          ],
          createdAt: new Date().toISOString(),
        },
      ]);

      scrollDown();
      setTimeout(() => send("", "continue"), 1500);
    } finally {
      setAssessing(null);
    }
  };

  const revealQuiz = (messageId: string, teachId: string) => {
    setRevealedQuizKeys((prev) => new Set(prev).add(quizRevealKey(messageId, teachId)));
    scrollDown();
  };

  useEffect(() => {
    sessionStarted.current = false;
    setReady(false);
    setMessages([]);
    setRecords([]);
    setSessionId(null);
    setRevealedQuizKeys(new Set());
    setError(null);

    loadHistory().then((loaded) => {
      setReady(true);
      if ((loaded?.length ?? 0) === 0 && !sessionStarted.current) {
        sessionStarted.current = true;
        sendRef.current("", "session_start");
      }
    });
  }, [user.id, loadHistory]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const pending = findPendingQuiz(messages);
    const letterAnswer = parseAnswerInput(text);
    if (pending && letterAnswer !== null && letterAnswer < (pending.options?.length ?? 0)) {
      setInput("");
      handleQuizAnswer(pending, letterAnswer);
      return;
    }

    send(text, "ask");
    setInput("");
  };

  return (
    <div className="flex h-[calc(100dvh-7.25rem)] flex-col">
      <StaffDemoSwitcher />
      <TutorTopBar avgMastery={avgMastery} />

      <div className="flex-1 overflow-y-auto pr-1 -mx-1 px-1">
        <div className="space-y-5 pb-4">
          {!ready && loading && (
            <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading your tutor…
            </div>
          )}

          {messages.map((m) => {
            const teachCard = m.cards?.find((c) => c.type === "teach");
            const quizCard = m.cards?.find((c) => c.type === "quiz");
            const quizRevealed =
              !teachCard ||
              revealedQuizKeys.has(quizRevealKey(m.id, teachCard.id)) ||
              Boolean(quizCard?.answered);

            return (
              <div key={m.id}>
                {m.role === "user" ? (
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-indigo-600 px-4 py-2.5 text-sm text-white">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!m.cards?.length && (
                      <div className="flex items-start gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                          <Bot className="h-4 w-4 text-indigo-600" />
                        </div>
                        <p className="flex-1 pt-1 text-sm leading-relaxed text-slate-600">
                          {m.content}
                        </p>
                      </div>
                    )}

                    {m.cards?.some((c) => c.type === "teach") && (
                      <p className="text-xs text-slate-500 px-1">{m.content.split("\n")[0]}</p>
                    )}

                    {m.cards && m.cards.length > 0 && (
                      <div className="space-y-3">
                        {m.cards.map((card) => {
                          if (card.type === "teach") {
                            return (
                              <TeachCard
                                key={card.id}
                                card={card}
                                quizRevealed={quizRevealed}
                                onReadyForQuiz={() => revealQuiz(m.id, card.id)}
                              />
                            );
                          }
                          if (card.type === "quiz") {
                            if (!quizRevealed) return null;
                            return (
                              <QuizCard
                                key={card.id}
                                card={card}
                                disabled={assessing === card.id}
                                onAnswer={(i) => handleQuizAnswer(card, i)}
                              />
                            );
                          }
                          if (card.type === "progress") {
                            return <ProgressChip key={card.id} card={card} />;
                          }
                          if (card.type === "gap_review") {
                            return (
                              <div
                                key={card.id}
                                className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm"
                              >
                                <p className="font-semibold text-amber-900">{card.title}</p>
                                <p className="mt-1 text-amber-800">{card.body}</p>
                                <Button
                                  type="button"
                                  size="sm"
                                  className="mt-3"
                                  onClick={() => send(`Teach me about ${card.domainName}`, "continue")}
                                >
                                  Start review
                                </Button>
                              </div>
                            );
                          }
                          return null;
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {loading && ready && (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Preparing next lesson…
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {ready && messages.length <= 2 && !loading && (
        <div className="mb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => send(s, "continue")}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 shadow-sm hover:border-indigo-300 hover:text-indigo-700"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form className="flex gap-2 border-t border-slate-200 pt-3" onSubmit={handleSubmit}>
        <Input
          placeholder={
            findPendingQuiz(messages)
              ? "Tap an answer above, or type A / B / C / D"
              : "Ask about your training…"
          }
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
          className="border-slate-200"
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
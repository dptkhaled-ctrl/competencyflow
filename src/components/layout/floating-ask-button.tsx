"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { Bot, Loader2, Send, Save, X, Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser, useCurrentOrg, useSavedShortcuts } from "@/lib/store/hooks";
import type { ChatMessage } from "@/lib/types";

function formatAnswer(text: string) {
  return text.split("\n").map((line, i) => {
    const bold = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    const italic = bold.replace(/_(.*?)_/g, "<em>$1</em>");
    return (
      <p
        key={i}
        className="text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: italic }}
      />
    );
  });
}



const BASE_SUGGESTIONS = [
  "What PPE is required on the floor?",
  "How do I report a near-miss?",
  "What are the hand hygiene rules?",
  "When should I log off my workstation?",
];

export function FloatingAskButton() {
  const user = useCurrentUser();
  const org = useCurrentOrg();

  const addChatMessage = useAppStore((s) => s.addChatMessage);
  const saveShortcut = useAppStore((s) => s.saveShortcut);
  const saved = useSavedShortcuts();
  const pendingAskQuestion = useAppStore((s) => s.pendingAskQuestion);
  const clearPendingAsk = () => useAppStore.setState({ pendingAskQuestion: null });

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  // Simple one-at-a-time ask UI instead of scrolling chat history.
  // History is still recorded (for manager pain points) but the staff UI is clean and non-scrolling.
  const [currentQuestion, setCurrentQuestion] = useState("");
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [currentCitations, setCurrentCitations] = useState<any[]>([]);

  const askLabel = "Ask Policy";
  const orgName = org?.name ?? "your organization";

  // Combine saved shortcuts + base suggestions (deduped, limit)
  const quickQuestions = Array.from(
    new Set([...saved, ...BASE_SUGGESTIONS])
  ).slice(0, 6);

  // Support contextual "Ask about this lesson" from Learn page
  useEffect(() => {
    if (pendingAskQuestion) {
      setInput(pendingAskQuestion);
      setOpen(true);
      clearPendingAsk();
    }
  }, [pendingAskQuestion]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const trimmed = text.trim();
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: trimmed,
      createdAt: new Date().toISOString(),
    };
    addChatMessage(user.id, userMsg); // still log for manager pain point summaries

    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: user.orgId, question: trimmed }),
      });
      const data = await res.json();

      const answer = data.answer || "I couldn't find a specific answer in our materials right now.";
      const citations = data.citations || [];

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: answer,
        citations,
        createdAt: new Date().toISOString(),
      };
      addChatMessage(user.id, assistantMsg); // log for managers

      // Set for simple non-scrolling UI
      setCurrentQuestion(trimmed);
      setCurrentAnswer(answer);
      setCurrentCitations(citations);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = (question: string) => {
    saveShortcut(user.id, question);
  };

  const isQuestionSaved = (q: string) => saved.includes(q);

  const clearCurrent = () => {
    setCurrentQuestion("");
    setCurrentAnswer("");
    setCurrentCitations([]);
    setInput("");
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setListening(false);
  };

  const toggleVoice = () => {
    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert("Voice input not supported in this browser. Please type instead.");
      return;
    }
    if (!recognitionRef.current) {
      const rec = new SpeechRec();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";
      rec.onresult = (ev: any) => {
        const transcript = ev.results[0][0].transcript;
        setInput(transcript);
        setListening(false);
        // Auto send after voice
        setTimeout(() => sendMessage(transcript), 200);
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

  if (!user) return null;

  return (
    <>
      {/* Floating Action Button — always visible, the star feature */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-[5.25rem] right-4 z-[60] flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition active:scale-[0.985] hover:bg-indigo-700 md:bottom-6 md:right-6 md:px-5"
        aria-label={askLabel}
      >
        <Bot className="h-4 w-4" />
        <span className="hidden md:inline">{askLabel}</span>
        <span className="md:hidden">Ask</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[78dvh] flex-col p-0 sm:h-[82dvh] md:h-[min(620px,88dvh)] md:max-w-md md:rounded-t-3xl"
        >
          <SheetHeader className="flex-shrink-0 border-b px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Bot className="h-4.5 w-4.5" />
                </div>
                <div>
                  <SheetTitle className="text-base font-semibold tracking-tight">
                    {askLabel}
                  </SheetTitle>
                  <p className="text-[11px] text-muted-foreground -mt-0.5">
                    Answers grounded only in {orgName} materials
                  </p>
                </div>
              </div>
              <SheetClose>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>

          {/* Quick shortcuts — easy way to switch to next questions */}
          <div className="flex-shrink-0 border-b bg-slate-50/60 px-3 py-2">
            <div className="text-[10px] font-medium text-slate-500 px-1 pb-1">
              Quick questions (tap to switch)
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-0.5 px-0.5">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  disabled={loading}
                  className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-indigo-50 hover:border-indigo-200 active:bg-indigo-100 transition"
                >
                  {q.length > 42 ? q.slice(0, 40) + "…" : q}
                </button>
              ))}
            </div>
          </div>

          {/* Simple non-scrolling content: either ask form or clean answer card */}
          <div className="flex-1 overflow-auto p-4">
            {!currentAnswer ? (
              // Initial / new question state - very simple
              <div className="space-y-4">
                <div className="text-center py-2">
                  <Bot className="mx-auto h-8 w-8 text-indigo-400 mb-2" />
                  <p className="font-medium">What do you need to know?</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Answers come only from {orgName}’s official policies and materials.
                  </p>
                </div>

                <form
                  className="flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendMessage(input);
                  }}
                >
                  <div className="flex-1 flex gap-1">
                    <Input
                      placeholder="Type your question here... (or use mic)"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      disabled={loading || listening}
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage(input);
                        }
                      }}
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant={listening ? "default" : "outline"}
                      onClick={toggleVoice}
                      disabled={loading}
                      className={listening ? "bg-red-600 hover:bg-red-700" : ""}
                      title={listening ? "Stop listening" : "Voice input"}
                    >
                      {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button
                    type="submit"
                    size="icon"
                    disabled={loading || !input.trim() || listening}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </form>

                <p className="text-center text-[10px] text-muted-foreground">
                  Tap any quick question above or type your own
                </p>
              </div>
            ) : (
              // Clean answer card - no chat log, just the result + easy next
              <div className="space-y-4">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">You asked</div>
                  <div className="font-medium text-base">{currentQuestion}</div>
                </div>

                <div className="rounded-2xl border bg-white p-4 shadow-sm">
                  <div className="text-sm leading-relaxed">
                    {formatAnswer(currentAnswer)}
                  </div>

                  {currentCitations.length > 0 && (
                    <div className="mt-4 pt-3 border-t text-xs text-muted-foreground">
                      <div className="font-medium mb-1 text-foreground/70">Based on</div>
                      {currentCitations.slice(0, 2).map((c, i) => (
                        <div key={i} className="truncate">• {c.documentTitle} — {c.section}</div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Simple actions to switch or save - no overwhelming history */}
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={clearCurrent}>
                    Ask a new question
                  </Button>
                  {!isQuestionSaved(currentQuestion) && (
                    <Button variant="outline" size="sm" onClick={() => handleSave(currentQuestion)}>
                      Save as shortcut
                    </Button>
                  )}
                </div>

                <div>
                  <div className="text-xs text-muted-foreground mb-1">Switch to another question:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {quickQuestions.slice(0, 4).map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        disabled={loading}
                        className="text-xs rounded-full border px-3 py-1 hover:bg-muted active:bg-muted/70 transition"
                      >
                        {q.length > 38 ? q.slice(0, 36) + "…" : q}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {loading && !currentAnswer && (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Getting answer from {orgName}’s materials…
              </div>
            )}
          </div>

          <div className="flex-shrink-0 border-t p-3 text-center">
            <p className="text-[10px] text-muted-foreground">
              Private to you. Your questions help your managers understand team gaps.
            </p>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

"use client";

import { useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store/app-store";
import { useCurrentUser, useManagerChatMessages } from "@/lib/store/hooks";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "Who is at risk and why?",
  "Which survey categories are we missing lessons for?",
  "What lessons do we have and where did they come from?",
  "Who is due for a refresher and what intervals are we using?",
  "Summarize our team's biggest training gaps",
];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        }`}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Competency AI
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}

export function ManagerChatPanel() {
  const user = useCurrentUser();
  const messages = useManagerChatMessages();
  const addManagerChatMessage = useAppStore((s) => s.addManagerChatMessage);
  const mergePlatformData = useAppStore((s) => s.mergePlatformData);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };
    addManagerChatMessage(user.id, userMsg);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/manager/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: user.orgId,
          teamId: user.teamId,
          managerId: user.id,
          message: text.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        addManagerChatMessage(user.id, {
          id: `msg-${Date.now()}-err`,
          role: "assistant",
          content: data.error ?? "Something went wrong. Try again.",
          createdAt: new Date().toISOString(),
        });
        return;
      }

      let answer = data.answer ?? "";
      if (data.actions?.length) {
        answer += `\n\n✓ Actions taken:\n${data.actions
          .map((a: { detail: string }) => `• ${a.detail}`)
          .join("\n")}`;
      }

      addManagerChatMessage(user.id, {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: answer,
        createdAt: new Date().toISOString(),
      });

      if (data.lessons || data.assignments || data.domainAssignments) {
        mergePlatformData({
          lessons: data.lessons,
          assignments: data.assignments,
        });
        if (data.domainAssignments) {
          useAppStore.getState().setCompetencyData({
            domainAssignments: data.domainAssignments,
          });
        }
      }
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    }
  };

  return (
    <div className="flex h-[calc(100dvh-8rem)] flex-col md:h-[calc(100dvh-10rem)]">
      <ScrollArea className="flex-1 pr-3">
        <div className="space-y-4 pb-4">
          {messages.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Sparkles className="mx-auto h-10 w-10 text-primary opacity-80" />
                <h3 className="mt-3 font-semibold">Competency AI</h3>
                <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">
                  Ask about survey readiness, lesson sources, staff progress,
                  refresher intervals, rotation status, and policy materials —
                  grounded in your live org data.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted text-left"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing your facility data…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form
        className="flex gap-2 border-t pt-3"
        onSubmit={(e) => {
          e.preventDefault();
          sendMessage(input);
        }}
      >
        <Input
          placeholder="Ask about lessons, staff, rotation, survey gaps…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
"use client";

import { useRef, useState } from "react";
import { Bot, Loader2, Send, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAppStore } from "@/lib/store/app-store";
import { useChatMessages, useCurrentUser } from "@/lib/store/hooks";
import type { ChatMessage } from "@/lib/types";

const SUGGESTIONS = [
  "What PPE is required on the floor?",
  "How do I report a near-miss?",
  "What are the hand hygiene rules?",
  "How should I handle a spill?",
];

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

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted"
        }`}
      >
        {!isUser && (
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Bot className="h-3.5 w-3.5" />
            Policy Assistant
          </div>
        )}
        <div className="space-y-1">
          {isUser ? (
            <p className="text-sm">{message.content}</p>
          ) : (
            formatAnswer(message.content)
          )}
        </div>
        {message.citations && message.citations.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-border/50 pt-2">
            <p className="text-xs font-medium text-muted-foreground">Sources</p>
            {message.citations.map((c, i) => (
              <div key={i} className="rounded-lg bg-background/60 p-2 text-xs">
                <div className="flex items-center gap-1 font-medium">
                  <FileText className="h-3 w-3" />
                  {c.documentTitle} · {c.section}
                </div>
                <p className="mt-1 text-muted-foreground">{c.excerpt}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const user = useCurrentUser();
  const messages = useChatMessages();
  const addChatMessage = useAppStore((s) => s.addChatMessage);
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
    addChatMessage(user.id, userMsg);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: user.orgId, question: text.trim() }),
      });
      const data = await res.json();

      const assistantMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: "assistant",
        content: data.answer,
        citations: data.citations,
        createdAt: new Date().toISOString(),
      };
      addChatMessage(user.id, assistantMsg);
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
                <Bot className="mx-auto h-10 w-10 text-primary opacity-80" />
                <h3 className="mt-3 font-semibold">Ask about your policies</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Answers are grounded in your organization&apos;s uploaded SOPs and policies.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => sendMessage(s)}
                      className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted"
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
              Thinking…
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
          placeholder="Ask a question about your policies…"
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
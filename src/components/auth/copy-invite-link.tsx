"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyInviteLink({
  link,
  label = "Activation link",
}: {
  link: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", link);
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-sm">
      <p className="font-medium text-amber-200 mb-2">{label}</p>
      <p className="break-all text-xs text-slate-300 mb-3 font-mono">{link}</p>
      <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
        {copied ? (
          <>
            <Check className="h-4 w-4" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" />
            Copy link
          </>
        )}
      </Button>
    </div>
  );
}
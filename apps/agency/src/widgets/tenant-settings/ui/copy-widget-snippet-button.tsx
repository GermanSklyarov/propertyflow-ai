"use client";

import { Check, Clipboard, ClipboardX } from "lucide-react";
import { useState, useTransition } from "react";
import styles from "./tenant-settings-panel.module.css";

type CopyState = "idle" | "copied" | "failed";

export function CopyWidgetSnippetButton({ label = "Copy code", snippet }: { label?: string; snippet: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const [isPending, startTransition] = useTransition();

  const copySnippet = () => {
    startTransition(async () => {
      try {
        await navigator.clipboard.writeText(snippet);
        setState("copied");
        window.setTimeout(() => setState("idle"), 2200);
      } catch {
        setState("failed");
        window.setTimeout(() => setState("idle"), 3200);
      }
    });
  };

  const Icon = state === "copied" ? Check : state === "failed" ? ClipboardX : Clipboard;

  return (
    <button className={styles.copySnippetButton} disabled={isPending} onClick={copySnippet} type="button">
      <Icon size={16} />
      {state === "copied" ? "Copied" : state === "failed" ? "Select manually" : label}
    </button>
  );
}

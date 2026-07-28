"use client";

import { ArrowRight, Bot, CheckCircle2, Loader2, MessageCircle, ShieldAlert } from "lucide-react";
import { type FormEvent, useMemo, useState, useTransition } from "react";
import type { PublicWidgetAskResponse, TenantWidgetLanguage } from "@propertyflow/contracts";
import type { WidgetDemoProfile, WidgetDemoPrompt } from "../model/widget-demo";
import styles from "./widget-demo-page.module.css";

export function WidgetDemoChat({
  initialLocale,
  profiles,
  prompts,
  tenantSlug
}: {
  initialLocale: TenantWidgetLanguage;
  profiles: WidgetDemoProfile[];
  prompts: WidgetDemoPrompt[];
  tenantSlug: string;
}) {
  const [locale, setLocale] = useState<TenantWidgetLanguage>(initialLocale);
  const activePrompt = useMemo(() => prompts.find((prompt) => prompt.locale === locale) ?? prompts[0], [locale, prompts]);
  const activeProfile = useMemo(() => profiles.find((profile) => profile.locale === locale) ?? profiles[0], [locale, profiles]);
  const [message, setMessage] = useState(activePrompt?.message ?? "");
  const [answer, setAnswer] = useState<PublicWidgetAskResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const ask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setAnswer(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/widget-demo-chat", {
          body: JSON.stringify({ locale, message, tenantSlug }),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok) {
          throw new Error(`Widget demo chat failed with HTTP ${response.status}`);
        }

        setAnswer((await response.json()) as PublicWidgetAskResponse);
      } catch (_error) {
        setError("Could not reach the live Concierge. Check API availability and AI provider credentials.");
      }
    });
  };

  const selectLocale = (nextLocale: TenantWidgetLanguage) => {
    const nextPrompt = prompts.find((prompt) => prompt.locale === nextLocale);

    setLocale(nextLocale);
    setMessage(nextPrompt?.message ?? "");
    setAnswer(null);
    setError(null);
  };

  return (
    <section className={styles.chatPanel} aria-label="Live widget demo">
      <div className={styles.chatHeader}>
        <div>
          <p className="section-kicker">Live widget</p>
          <h2>{activeProfile?.aiName ?? "AI Concierge"}</h2>
        </div>
        <Bot size={22} />
      </div>

      <div className={styles.localeTabs} aria-label="Widget locale">
        {prompts.map((prompt) => (
          <button
            aria-pressed={prompt.locale === locale}
            key={prompt.locale}
            onClick={() => selectLocale(prompt.locale)}
            type="button"
          >
            {prompt.locale.toUpperCase()}
          </button>
        ))}
      </div>

      <div className={styles.chatTranscript}>
        <div className={styles.assistantBubble}>
          <strong>{activeProfile?.aiName ?? "AI Concierge"}</strong>
          <p>{activeProfile?.welcomeMessage ?? "Hi! How can I help with Thailand property today?"}</p>
        </div>

        {answer ? (
          <>
            <div className={styles.userBubble}>
              <p>{answer.message}</p>
            </div>
            <div className={styles.assistantBubble}>
              <strong>{activeProfile?.aiName ?? "AI Concierge"}</strong>
              <p>{answer.answer}</p>
              <div className={styles.answerMeta}>
                <span>
                  <CheckCircle2 size={14} />
                  {answer.generation?.mode === "llm" ? "LLM answer" : "Fallback answer"}
                </span>
                <span>{answer.matchedPropertyIds.length} listings</span>
                <span>{answer.citations.length} citations</span>
              </div>
            </div>
          </>
        ) : null}

        {error ? (
          <div className={styles.errorBubble} aria-live="polite">
            <ShieldAlert size={16} />
            {error}
          </div>
        ) : null}
      </div>

      <form className={styles.chatForm} onSubmit={ask}>
        <textarea
          onChange={(event) => {
            setMessage(event.target.value);
            setAnswer(null);
            setError(null);
          }}
          rows={4}
          value={message}
        />
        <button disabled={isPending || !message.trim()} type="submit">
          {isPending ? <Loader2 className={styles.spinIcon} size={17} /> : <MessageCircle size={17} />}
          {isPending ? "Asking" : "Ask live AI"}
          <ArrowRight size={17} />
        </button>
      </form>
    </section>
  );
}

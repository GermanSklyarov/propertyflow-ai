"use client";

import { Bot, CheckCircle2, MessageCircle, ShieldAlert } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import type { TenantWidgetLanguage } from "@propertyflow/contracts";
import { getDefaultConciergeAnswerCheckMessage, type ConciergeAnswerCheckResult } from "../model/concierge-answer-check";
import styles from "./tenant-settings-panel.module.css";

export function ConciergeAnswerCheckForm({
  defaultWidgetPageUrl,
  locale,
  tenantSlug
}: {
  defaultWidgetPageUrl?: string;
  locale: TenantWidgetLanguage;
  tenantSlug: string;
}) {
  const [message, setMessage] = useState(getDefaultConciergeAnswerCheckMessage(locale));
  const [widgetPageUrl, setWidgetPageUrl] = useState(defaultWidgetPageUrl ?? "");
  const [result, setResult] = useState<ConciergeAnswerCheckResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const verify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/concierge-answer-check", {
          body: JSON.stringify({
            locale,
            message,
            tenantSlug,
            widgetPageUrl
          }),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok) {
          throw new Error(`Concierge check failed with HTTP ${response.status}`);
        }

        setResult((await response.json()) as ConciergeAnswerCheckResult);
      } catch (_error) {
        setError("Could not ask the live Concierge. Check the page URL, allowed origins, AI provider credentials, and API availability.");
      }
    });
  };

  const statusClass = result?.status === "verified" ? styles.installCheckVerified : styles.installCheckWarning;
  const ResultIcon = result?.status === "verified" ? CheckCircle2 : ShieldAlert;

  return (
    <form className={styles.conciergeAnswerCheck} onSubmit={verify}>
      <div className={styles.conciergeAnswerCheckHeader}>
        <div className={styles.conciergeAnswerCheckTitle}>
          <Bot size={15} />
          Live AI answer check
        </div>
        <span className={styles.conciergeAnswerCheckLocale}>{locale.toUpperCase()}</span>
      </div>
      <div className={styles.conciergeAnswerCheckRow}>
        <input
          aria-label="Widget page URL"
          id="concierge-answer-check-page-url"
          onChange={(event) => {
            setWidgetPageUrl(event.target.value);
            setError(null);
            setResult(null);
          }}
          placeholder="https://agency.example.com"
          type="url"
          value={widgetPageUrl}
        />
        <input
          aria-label="Concierge check question"
          id="concierge-answer-check-message"
          onChange={(event) => {
            setMessage(event.target.value);
            setError(null);
            setResult(null);
          }}
          value={message}
        />
        <button disabled={isPending || !message.trim() || !tenantSlug || !widgetPageUrl.trim()} type="submit">
          <MessageCircle size={17} />
          {isPending ? "Asking" : "Ask Concierge"}
        </button>
      </div>
      {result ? (
        <div className={`${styles.installCheckResult} ${statusClass}`} aria-live="polite">
          <ResultIcon size={17} />
          <div>
            <strong>{result.label}</strong>
            <span>{result.message}</span>
            <em>
              {formatGeneration(result.generation)} · {result.matchedProperties} listings · {result.citations.knowledge} knowledge citations
            </em>
          </div>
        </div>
      ) : null}
      {result ? (
        <details className={styles.conciergeAnswerDetails}>
          <summary>
            Answer preview
            <span>{result.citations.total} citations</span>
          </summary>
          <p>{result.answerPreview}</p>
          <small>{result.nextAction}</small>
        </details>
      ) : null}
      {error ? (
        <div className={`${styles.installCheckResult} ${styles.installCheckWarning}`} aria-live="polite">
          <ShieldAlert size={17} />
          <span>{error}</span>
        </div>
      ) : null}
    </form>
  );
}

function formatGeneration(generation: ConciergeAnswerCheckResult["generation"]) {
  if (!generation) {
    return "generation unknown";
  }

  if (generation.mode === "deterministic-fallback") {
    return "fallback";
  }

  return [generation.provider, generation.model].filter(Boolean).join(" · ") || "LLM";
}

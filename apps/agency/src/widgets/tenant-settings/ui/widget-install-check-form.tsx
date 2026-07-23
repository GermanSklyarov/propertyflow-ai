"use client";

import { CheckCircle2, SearchCheck, ShieldAlert } from "lucide-react";
import { type FormEvent, useState, useTransition } from "react";
import type { TenantWidgetInstallCheckResponse } from "@propertyflow/contracts";
import { formatWidgetInstallCheckStatus, isWidgetInstallVerified } from "../model/widget-install-check";
import styles from "./tenant-settings-panel.module.css";

export function WidgetInstallCheckForm({ defaultUrl }: { defaultUrl?: string }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [result, setResult] = useState<TenantWidgetInstallCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const verify = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResult(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/widget-install-check", {
          body: JSON.stringify({ url }),
          headers: {
            "content-type": "application/json"
          },
          method: "POST"
        });

        if (!response.ok) {
          throw new Error(`Check failed with HTTP ${response.status}`);
        }

        setResult((await response.json()) as TenantWidgetInstallCheckResponse);
      } catch (_error) {
        setError("Could not run the install check. Confirm the URL and try again.");
      }
    });
  };

  const isVerified = isWidgetInstallVerified(result);
  const ResultIcon = isVerified ? CheckCircle2 : ShieldAlert;

  return (
    <form className={styles.installCheck} onSubmit={verify}>
      <label htmlFor="widget-install-url">Check installed widget</label>
      <div className={styles.installCheckRow}>
        <input
          id="widget-install-url"
          onChange={(event) => {
            setUrl(event.target.value);
            setError(null);
            setResult(null);
          }}
          placeholder="https://agency.example.com"
          type="url"
          value={url}
        />
        <button disabled={isPending || !url.trim()} type="submit">
          <SearchCheck size={17} />
          {isPending ? "Checking" : "Run check"}
        </button>
      </div>
      {result ? (
        <div className={`${styles.installCheckResult} ${isVerified ? styles.installCheckVerified : styles.installCheckWarning}`} aria-live="polite">
          <ResultIcon size={17} />
          <div>
            <strong>{formatWidgetInstallCheckStatus(result.status)}</strong>
            <span>{result.message}</span>
            <em>{result.nextAction}</em>
          </div>
        </div>
      ) : null}
      {result?.checks?.length ? (
        <div className={styles.installCheckDiagnostics} aria-label="Widget install diagnostics">
          {result.checks.map((check) => (
            <div className={styles.installCheckDiagnostic} data-status={check.status} key={check.key}>
              <strong>{check.label}</strong>
              <span>{check.note}</span>
            </div>
          ))}
        </div>
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

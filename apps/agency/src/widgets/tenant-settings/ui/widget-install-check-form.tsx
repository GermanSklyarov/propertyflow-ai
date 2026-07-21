"use client";

import { CheckCircle2, SearchCheck, ShieldAlert } from "lucide-react";
import { useState, useTransition } from "react";
import type { TenantWidgetInstallCheckResponse } from "@propertyflow/contracts";
import styles from "./tenant-settings-panel.module.css";

export function WidgetInstallCheckForm({ defaultUrl }: { defaultUrl?: string }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [result, setResult] = useState<TenantWidgetInstallCheckResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const verify = () => {
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

  const isVerified = result?.status === "verified";
  const ResultIcon = isVerified ? CheckCircle2 : ShieldAlert;

  return (
    <div className={styles.installCheck}>
      <label htmlFor="widget-install-url">Check installed widget</label>
      <div className={styles.installCheckRow}>
        <input
          id="widget-install-url"
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://agency.example.com"
          type="url"
          value={url}
        />
        <button disabled={isPending || !url.trim()} onClick={verify} type="button">
          <SearchCheck size={17} />
          {isPending ? "Checking" : "Run check"}
        </button>
      </div>
      {result ? (
        <div className={`${styles.installCheckResult} ${isVerified ? styles.installCheckVerified : styles.installCheckWarning}`} aria-live="polite">
          <ResultIcon size={17} />
          <div>
            <strong>{formatInstallCheckStatus(result.status)}</strong>
            <span>{result.message}</span>
          </div>
        </div>
      ) : null}
      {error ? (
        <div className={`${styles.installCheckResult} ${styles.installCheckWarning}`} aria-live="polite">
          <ShieldAlert size={17} />
          <span>{error}</span>
        </div>
      ) : null}
    </div>
  );
}

function formatInstallCheckStatus(status: TenantWidgetInstallCheckResponse["status"]) {
  const labels: Record<TenantWidgetInstallCheckResponse["status"], string> = {
    "blocked-origin": "Origin blocked",
    "missing-widget": "Widget missing",
    unreachable: "Page unreachable",
    verified: "Widget verified",
    "wrong-tenant": "Wrong tenant"
  };

  return labels[status];
}

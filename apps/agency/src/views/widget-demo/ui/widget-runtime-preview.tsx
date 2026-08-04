"use client";

import { CheckCircle2, Code2, ShieldAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { WidgetInstallConfig } from "@widgets/tenant-settings/model/widget-install";
import styles from "./widget-demo-page.module.css";

export function WidgetRuntimePreview({
  apiBaseUrl,
  config,
  scriptSrc
}: {
  apiBaseUrl: string;
  config: WidgetInstallConfig;
  scriptSrc: string;
}) {
  const [status, setStatus] = useState<"error" | "loading" | "ready">("loading");
  const scriptId = useMemo(() => `propertyflow-widget-runtime-${config.tenantSlug}`, [config.tenantSlug]);

  useEffect(() => {
    const existingRoot = document.querySelector("[data-propertyflow-widget-root]");
    const existingScript = document.getElementById(scriptId);

    existingRoot?.remove();
    existingScript?.remove();
    setStatus("loading");

    const script = document.createElement("script");
    script.id = scriptId;
    script.src = scriptSrc;
    script.async = true;
    script.setAttribute("data-api-base", apiBaseUrl);
    script.setAttribute("data-tenant", config.tenantSlug);
    script.setAttribute("data-mode", config.mode);
    script.setAttribute("data-locale", "auto");
    script.setAttribute("data-ai-name", config.aiName);
    script.setAttribute("data-ai-names", JSON.stringify(config.aiNames));
    script.setAttribute("data-persona-genders", JSON.stringify(config.personaGenders));
    script.setAttribute("data-tone", config.tone);
    script.setAttribute("data-welcome-message", config.welcomeMessage);
    script.setAttribute("data-welcome-messages", JSON.stringify(config.welcomeMessages));
    script.setAttribute("data-languages", config.languageCodes.join(","));
    script.addEventListener("load", () => setStatus("ready"));
    script.addEventListener("error", () => setStatus("error"));
    document.body.append(script);

    return () => {
      script.remove();
      document.querySelector("[data-propertyflow-widget-root]")?.remove();
    };
  }, [apiBaseUrl, config, scriptId, scriptSrc]);

  const StatusIcon = status === "ready" ? CheckCircle2 : status === "error" ? ShieldAlert : Code2;

  return (
    <section className={styles.runtimePanel} data-status={status} aria-label="Embedded widget runtime preview">
      <div className={styles.runtimeStatus}>
        <StatusIcon size={18} />
        <div>
          <strong>{formatRuntimeStatus(status)}</strong>
          <span>{status === "ready" ? "Open the launcher in the bottom-right corner of this page." : getRuntimeStatusNote(status)}</span>
        </div>
      </div>
      <div className={styles.runtimeFacts}>
        <span>
          <strong>Script</strong>
          {scriptSrc}
        </span>
        <span>
          <strong>API</strong>
          {apiBaseUrl}
        </span>
        <span>
          <strong>Tenant</strong>
          {config.tenantSlug}
        </span>
      </div>
    </section>
  );
}

function formatRuntimeStatus(status: "error" | "loading" | "ready") {
  const labels = {
    error: "Widget runtime failed",
    loading: "Loading widget runtime",
    ready: "Widget runtime loaded"
  } satisfies Record<typeof status, string>;

  return labels[status];
}

function getRuntimeStatusNote(status: "error" | "loading" | "ready") {
  if (status === "error") {
    return "The demo could not load widget.js. Check that the agency app can serve /api/widget-runtime.";
  }

  return "The demo is inserting the same embeddable script used by agency websites.";
}

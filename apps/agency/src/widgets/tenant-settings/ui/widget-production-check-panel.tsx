"use client";

import { CheckCircle2, CircleDot, Rocket, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import type { TenantWidgetInstallCheckResponse, TenantWidgetLanguage } from "@propertyflow/contracts";
import type { ConciergeAnswerCheckResult } from "../model/concierge-answer-check";
import { buildWidgetProductionReadiness } from "../model/widget-production-readiness";
import { ConciergeAnswerCheckForm } from "./concierge-answer-check-form";
import styles from "./tenant-settings-panel.module.css";
import { WidgetInstallCheckForm } from "./widget-install-check-form";

export function WidgetProductionCheckPanel({
  defaultWidgetPageUrl,
  locale,
  tenantSlug
}: {
  defaultWidgetPageUrl?: string;
  locale: TenantWidgetLanguage;
  tenantSlug: string;
}) {
  const [widgetPageUrl, setWidgetPageUrl] = useState(defaultWidgetPageUrl ?? "");
  const [installResult, setInstallResult] = useState<TenantWidgetInstallCheckResponse | null>(null);
  const [answerResult, setAnswerResult] = useState<ConciergeAnswerCheckResult | null>(null);
  const productionReadiness = useMemo(
    () =>
      buildWidgetProductionReadiness({
        answerResult,
        installResult,
        widgetPageUrl
      }),
    [answerResult, installResult, widgetPageUrl]
  );

  const StatusIcon = productionReadiness.status === "verified" ? CheckCircle2 : productionReadiness.status === "blocked" ? ShieldAlert : Rocket;

  const updateWidgetPageUrl = (nextUrl: string) => {
    setWidgetPageUrl(nextUrl);
    setInstallResult(null);
    setAnswerResult(null);
  };

  return (
    <section className={styles.productionCheckPanel} data-status={productionReadiness.status} aria-label="Live widget verification">
      <div className={styles.productionCheckStatus}>
        <StatusIcon size={18} />
        <div>
          <strong>{productionReadiness.label}</strong>
          <span>{productionReadiness.message}</span>
          <em>{productionReadiness.nextAction}</em>
        </div>
      </div>

      <div className={styles.productionCheckList}>
        {productionReadiness.checks.map((check) => {
          const CheckIcon = check.done ? CheckCircle2 : CircleDot;

          return (
            <div className={styles.productionCheckItem} data-ready={String(check.done)} key={check.id}>
              <CheckIcon size={15} />
              <span>
                <strong>{check.label}</strong>
                <small>{check.note}</small>
              </span>
            </div>
          );
        })}
      </div>

      <WidgetInstallCheckForm onResultChange={setInstallResult} onUrlChange={updateWidgetPageUrl} url={widgetPageUrl} />
      <ConciergeAnswerCheckForm
        locale={locale}
        onResultChange={setAnswerResult}
        onWidgetPageUrlChange={updateWidgetPageUrl}
        tenantSlug={tenantSlug}
        widgetPageUrl={widgetPageUrl}
      />
    </section>
  );
}

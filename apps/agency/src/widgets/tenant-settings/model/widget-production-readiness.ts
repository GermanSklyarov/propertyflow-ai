import type { TenantWidgetInstallCheckResponse } from "@propertyflow/contracts";
import type { ConciergeAnswerCheckResult } from "./concierge-answer-check";
import { isWidgetInstallVerified } from "./widget-install-check";

export type WidgetProductionReadinessStatus = "blocked" | "not-started" | "review" | "verified";

export interface WidgetProductionReadinessCheck {
  done: boolean;
  id: "page-url" | "install" | "answer";
  label: string;
  note: string;
}

export interface WidgetProductionReadiness {
  checks: WidgetProductionReadinessCheck[];
  label: string;
  message: string;
  nextAction: string;
  status: WidgetProductionReadinessStatus;
}

export function buildWidgetProductionReadiness({
  answerResult,
  installResult,
  widgetPageUrl
}: {
  answerResult: ConciergeAnswerCheckResult | null;
  installResult: TenantWidgetInstallCheckResponse | null;
  widgetPageUrl: string;
}): WidgetProductionReadiness {
  const hasWidgetPageUrl = Boolean(widgetPageUrl.trim());
  const installVerified = isWidgetInstallVerified(installResult);
  const answerVerified = answerResult?.status === "verified";
  const checks: WidgetProductionReadinessCheck[] = [
    {
      done: hasWidgetPageUrl,
      id: "page-url",
      label: "Live page URL",
      note: hasWidgetPageUrl ? `Checks run against ${widgetPageUrl.trim()}.` : "Enter the live or staging page where the widget is installed."
    },
    {
      done: installVerified,
      id: "install",
      label: "Widget installed",
      note: installResult?.message ?? "Run the install check to verify script presence, tenant slug, and origin allowlist."
    },
    {
      done: answerVerified,
      id: "answer",
      label: "AI answer verified",
      note: answerResult?.message ?? "Ask the live Concierge from the same page origin to verify LLM grounding."
    }
  ];

  if (!hasWidgetPageUrl || (!installResult && !answerResult)) {
    return {
      checks,
      label: "Live verification not started",
      message: "Run both checks against the same agency page before treating the widget as production-ready.",
      nextAction: hasWidgetPageUrl ? "Run install check, then ask the live Concierge." : "Enter the page URL where the widget is installed.",
      status: "not-started"
    };
  }

  if (installResult && !installVerified) {
    return {
      checks,
      label: "Live install blocked",
      message: installResult.message,
      nextAction: installResult.nextAction,
      status: "blocked"
    };
  }

  if (answerResult && !answerVerified) {
    return {
      checks,
      label: "AI answer needs review",
      message: answerResult.message,
      nextAction: answerResult.nextAction,
      status: "review"
    };
  }

  if (installVerified && answerVerified) {
    return {
      checks,
      label: "Live widget verified",
      message: "The installed widget is present, tenant-scoped, origin-aware, and returns grounded LLM answers.",
      nextAction: "Keep this URL as the production reference before copying the snippet to other agency pages.",
      status: "verified"
    };
  }

  return {
    checks,
    label: "Finish live verification",
    message: "One production check has passed. Complete the other check before launch.",
    nextAction: installVerified ? "Ask the live Concierge from this page." : "Run the widget install check for this page.",
    status: "review"
  };
}

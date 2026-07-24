import type { BackgroundJobMonitorItem, KnowledgeDocumentSnapshot, TenantSnapshot } from "@propertyflow/contracts";
import { countRunningKnowledgeJobs } from "@entities/jobs/model/background-jobs";
import { buildKnowledgeStarterReadiness } from "@entities/knowledge/model/knowledge-starter-readiness";
import { getTenantWidgetSettings } from "@entities/tenant/model/widget-settings";
import {
  buildWidgetInstallPackage,
  buildWidgetLaunchReadinessItems,
  summarizeWidgetLaunchReadiness
} from "@widgets/tenant-settings/model/widget-install";

export type StarterSetupStepStatus = "action" | "blocked" | "complete" | "waiting";

export interface StarterSetupStep {
  actionHref: string;
  actionLabel: string;
  description: string;
  id: string;
  status: StarterSetupStepStatus;
  title: string;
  value: string;
}

export interface StarterSetupProgress {
  completed: number;
  launchReady: boolean;
  nextAction: StarterSetupStep;
  steps: StarterSetupStep[];
  total: number;
}

export function buildStarterSetupProgress({
  documents,
  jobs,
  tenant
}: {
  documents: KnowledgeDocumentSnapshot[];
  jobs: BackgroundJobMonitorItem[];
  tenant: TenantSnapshot;
}): StarterSetupProgress {
  const activeKnowledgeJobs = countRunningKnowledgeJobs(jobs);
  const knowledgeReadiness = buildKnowledgeStarterReadiness(documents, activeKnowledgeJobs);
  const widgetInstall = buildWidgetInstallPackage(tenant);
  const widgetSettings = getTenantWidgetSettings(tenant);
  const widgetLaunchReadiness = summarizeWidgetLaunchReadiness({
    hasActiveKnowledgeJobs: activeKnowledgeJobs > 0,
    hasLaunchReadyKnowledge: knowledgeReadiness.launchReady,
    hasTenantSlug: Boolean(tenant.slug),
    runtimeReadiness: widgetInstall.readiness
  });
  const widgetReadinessItems = buildWidgetLaunchReadinessItems({
    hasActiveKnowledgeJobs: activeKnowledgeJobs > 0,
    hasLaunchReadyKnowledge: knowledgeReadiness.launchReady,
    hasTenantSlug: Boolean(tenant.slug),
    runtimeReadiness: widgetInstall.readiness,
    starterSourceTypesReady: knowledgeReadiness.completed,
    tenantSlug: tenant.slug
  });
  const languageCheckReady = widgetInstall.readiness.checks
    .filter((check) => check.key === "languages" || check.key === "localized-welcome")
    .every((check) => check.ready);
  const originCheckReady = widgetInstall.readiness.checks.find((check) => check.key === "origin-policy")?.ready ?? false;

  const steps: StarterSetupStep[] = [
    {
      actionHref: "/knowledge?create=source#create-knowledge-document",
      actionLabel: knowledgeReadiness.launchReady ? "Review sources" : "Add knowledge",
      description: knowledgeReadiness.nextAction,
      id: "knowledge",
      status: knowledgeReadiness.launchReady ? "complete" : activeKnowledgeJobs > 0 ? "waiting" : "action",
      title: "Knowledge Sources",
      value: `${knowledgeReadiness.completed}/${knowledgeReadiness.total} ready`
    },
    {
      actionHref: "/settings#concierge-personality-settings",
      actionLabel: languageCheckReady ? "Review personality" : "Edit personality",
      description: languageCheckReady
        ? "Enabled languages have localized Concierge names and welcome messages."
        : "Set the assistant names, welcome messages, tone, and supported languages.",
      id: "personality",
      status: languageCheckReady ? "complete" : "action",
      title: "AI personality",
      value: `${widgetSettings.languages.length} locales`
    },
    {
      actionHref: "/settings#widget-origin-settings",
      actionLabel: originCheckReady ? "Review origins" : "Add origins",
      description: originCheckReady
        ? "Production website origins are configured for the widget."
        : "Keep test mode while configuring the agency website origin allowlist.",
      id: "origins",
      status: originCheckReady ? "complete" : "blocked",
      title: "Website origins",
      value: originCheckReady ? "Production ready" : "Test mode"
    },
    {
      actionHref: "/settings#widget-install",
      actionLabel: widgetLaunchReadiness.completed === widgetLaunchReadiness.total ? "Copy snippet" : "Fix blockers",
      description: widgetReadinessItems
        .filter((item) => !item.done)
        .slice(0, 2)
        .map((item) => item.note)
        .join(" ")
        || "Widget snippet is ready to copy into the agency website.",
      id: "widget",
      status: widgetLaunchReadiness.completed === widgetLaunchReadiness.total ? "complete" : "blocked",
      title: "Website widget",
      value: `${widgetLaunchReadiness.completed}/${widgetLaunchReadiness.total} checks`
    }
  ];
  const completed = steps.filter((step) => step.status === "complete").length;

  return {
    completed,
    launchReady: completed === steps.length,
    nextAction: steps.find((step) => step.status !== "complete") ?? steps[steps.length - 1],
    steps,
    total: steps.length
  };
}

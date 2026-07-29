import type {
  BackgroundJobMonitorItem,
  KnowledgeEmbeddingHealthSnapshot,
  KnowledgeDocumentSnapshot,
  TenantSnapshot,
  TenantSubscriptionPlan
} from "@propertyflow/contracts";
import { getTenantPlanDefinition } from "@propertyflow/contracts";
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
  blockers: StarterSetupStep[];
  completed: number;
  launchReady: boolean;
  nextAction: StarterSetupStep;
  requestedPlanLabel: string;
  selectedPlanMatchesWorkspace: boolean;
  steps: StarterSetupStep[];
  total: number;
  upgradePreview: StarterSetupUpgradePreview | null;
  workspacePlanLabel: string;
}

export interface StarterSetupUpgradePreview {
  actionHref: string;
  actionLabel: string;
  description: string;
  features: string[];
  title: string;
}

export interface StarterEmbeddingReadiness {
  actionLabel: string;
  current: number;
  failed: number;
  pending: number;
  providerLabel: string;
  ready: boolean;
  stale: number;
  summary: string;
  total: number;
  unembedded: number;
}

export function buildStarterSetupProgress({
  documents,
  jobs,
  requestedPlan,
  tenant
}: {
  documents: KnowledgeDocumentSnapshot[];
  jobs: BackgroundJobMonitorItem[];
  requestedPlan?: TenantSubscriptionPlan;
  tenant: TenantSnapshot;
}): StarterSetupProgress {
  const activeKnowledgeJobs = countRunningKnowledgeJobs(jobs);
  const knowledgeReadiness = buildKnowledgeStarterReadiness(documents, activeKnowledgeJobs);
  const widgetInstall = buildWidgetInstallPackage(tenant);
  const widgetSettings = getTenantWidgetSettings(tenant);
  const plan = getTenantPlanDefinition(tenant.subscriptionPlan);
  const selectedPlan = getTenantPlanDefinition(requestedPlan ?? tenant.subscriptionPlan);
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
      actionHref: "/settings#plan-upgrade",
      actionLabel: "Review plan",
      description: `${plan.name} selected: ${plan.positioning}`,
      id: "plan",
      status: "complete",
      title: "Plan confirmation",
      value: plan.name
    },
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
  const blockers = steps.filter((step) => step.status !== "complete").slice(0, 3);

  return {
    blockers,
    completed,
    launchReady: completed === steps.length,
    nextAction: steps.find((step) => step.status !== "complete") ?? steps[steps.length - 1],
    requestedPlanLabel: selectedPlan.name,
    selectedPlanMatchesWorkspace: selectedPlan.id === plan.id,
    steps,
    total: steps.length,
    upgradePreview: buildStarterSetupUpgradePreview(requestedPlan, tenant.subscriptionPlan),
    workspacePlanLabel: plan.name
  };
}

function buildStarterSetupUpgradePreview(
  requestedPlan: TenantSubscriptionPlan | undefined,
  workspacePlan: TenantSubscriptionPlan
): StarterSetupUpgradePreview | null {
  if (requestedPlan !== "growth" || workspacePlan !== "starter") {
    return null;
  }

  return {
    actionHref: "/settings#plan-upgrade",
    actionLabel: "Review Growth controls",
    description:
      "Keep Starter running the Concierge now, then unlock CRM lead creation when conversations become viewing or callback requests.",
    features: ["Conversation to lead handoff", "Agent assignment", "Pipeline follow-up", "Saved demand and analytics"],
    title: "Growth is the next step after Starter"
  };
}

export function buildStarterEmbeddingReadiness(embeddingHealth: KnowledgeEmbeddingHealthSnapshot): StarterEmbeddingReadiness {
  const pending = embeddingHealth.pendingChunks;
  const needsRefresh = embeddingHealth.unembeddedChunks;
  const providerLabel = `${embeddingHealth.targetProvider} · ${embeddingHealth.targetModel}`;

  if (!embeddingHealth.totalChunks) {
    return {
      actionLabel: "Add knowledge first",
      current: 0,
      failed: 0,
      pending: 0,
      providerLabel,
      ready: false,
      stale: 0,
      summary: "No searchable chunks yet. Add at least one knowledge source before testing Concierge answers.",
      total: 0,
      unembedded: 0
    };
  }

  if (embeddingHealth.ready) {
    return {
      actionLabel: "Refresh vectors",
      current: embeddingHealth.currentChunks,
      failed: embeddingHealth.failedChunks,
      pending,
      providerLabel,
      ready: true,
      stale: embeddingHealth.staleChunks,
      summary: `${embeddingHealth.currentChunks}/${embeddingHealth.totalChunks} chunks are using the active embedding provider.`,
      total: embeddingHealth.totalChunks,
      unembedded: embeddingHealth.unembeddedChunks
    };
  }

  return {
    actionLabel: "Refresh vectors",
    current: embeddingHealth.currentChunks,
    failed: embeddingHealth.failedChunks,
    pending,
    providerLabel,
    ready: false,
    stale: embeddingHealth.staleChunks,
    summary: `${needsRefresh} chunks need fresh vectors before Concierge retrieval is production-ready.`,
    total: embeddingHealth.totalChunks,
    unembedded: embeddingHealth.unembeddedChunks
  };
}

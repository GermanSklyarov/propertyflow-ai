import {
  BadgeCheck,
  Building2,
  CheckCircle2,
  CircleDot,
  Code2,
  FileText,
  Globe2,
  KeyRound,
  Languages,
  MessageCircle,
  Palette,
  Pencil,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Users
} from "lucide-react";
import type { ReactNode } from "react";
import { UpdateTenantSettingsForm } from "@features/tenant-settings-update/ui/update-tenant-settings-form";
import { hasRunningKnowledgeJobs } from "@entities/jobs/model/background-jobs";
import { buildKnowledgeStarterReadiness } from "@entities/knowledge/model/knowledge-starter-readiness";
import type {
  BackgroundJobMonitorItem,
  KnowledgeDocumentSnapshot,
  TenantSnapshot,
  TenantUsageMetric,
  TenantUsageResponse
} from "@propertyflow/contracts";
import { getTenantWidgetSettings } from "@entities/tenant/model/widget-settings";
import { formatDate, formatNumber, formatPercent } from "@shared/lib/formatters";
import {
  buildWidgetInstallPackage,
  buildWidgetLaunchReadinessItems,
  summarizeWidgetInstallSteps,
  summarizeWidgetLaunchReadiness
} from "../model/widget-install";
import { CopyWidgetSnippetButton } from "./copy-widget-snippet-button";
import styles from "./tenant-settings-panel.module.css";
import { WidgetInstallCheckForm } from "./widget-install-check-form";

export function TenantSettingsPanel({
  knowledgeDocuments,
  knowledgeJobs,
  saved,
  tenant,
  usage
}: {
  knowledgeDocuments: KnowledgeDocumentSnapshot[];
  knowledgeJobs: BackgroundJobMonitorItem[];
  saved?: boolean;
  tenant: TenantSnapshot;
  usage: TenantUsageResponse;
}) {
  const readinessItems = buildReadinessItems(tenant, usage);
  const completedReadiness = readinessItems.filter((item) => item.done).length;
  const starterReadiness = buildKnowledgeStarterReadiness(knowledgeDocuments);
  const activeKnowledgeJobs = hasRunningKnowledgeJobs(knowledgeJobs);
  const widgetInstall = buildWidgetInstallPackage(tenant);
  const widgetSettings = getTenantWidgetSettings(tenant);
  const widgetLaunchReadiness = summarizeWidgetLaunchReadiness({
    hasActiveKnowledgeJobs: activeKnowledgeJobs,
    hasLaunchReadyKnowledge: starterReadiness.launchReady,
    hasTenantSlug: Boolean(tenant.slug),
    runtimeReadiness: widgetInstall.readiness
  });
  const widgetLaunchReadinessItems = buildWidgetLaunchReadinessItems({
    hasActiveKnowledgeJobs: activeKnowledgeJobs,
    hasLaunchReadyKnowledge: starterReadiness.launchReady,
    hasTenantSlug: Boolean(tenant.slug),
    runtimeReadiness: widgetInstall.readiness,
    starterSourceTypesReady: starterReadiness.completed,
    tenantSlug: tenant.slug
  });
  const widgetInstallStepSummary = summarizeWidgetInstallSteps(widgetInstall.steps);
  const localizedWidgetSnippets = widgetInstall.localeOptions.filter((option) => option.value !== 'data-locale="auto"');

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Tenant settings overview">
        <KpiCard icon={<Building2 size={18} />} label="Plan" note="Subscription tier" value={tenant.subscriptionPlan} />
        <KpiCard icon={<Globe2 size={18} />} label="Domain" note={tenant.customDomain ?? "Not configured"} value={formatDomainStatus(tenant.domainStatus)} />
        <KpiCard icon={<Users size={18} />} label="Agents" note="Seats used" value={formatUsage(getUsage(usage.items, "agents"))} />
        <KpiCard icon={<Code2 size={18} />} label="Public API" note="Requests this month" value={formatUsage(getUsage(usage.items, "publicApiRequestsMonthly"))} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">AI Concierge Starter</p>
            <h2 className={styles.panelTitle}>Launch AI before CRM</h2>
          </div>
          <span className={styles.statusBadge}>Knowledge first</span>
        </div>
        <div className={styles.starterGrid}>
          <article className={styles.starterHero}>
            <Rocket size={22} />
            <div>
              <strong>Welcome to PropertyFlowAI</strong>
              <p>
                Connect documents, publish the website widget, and tune the assistant personality. CRM turns on later when a
                conversation becomes a real lead.
              </p>
            </div>
          </article>

          <div className={styles.launchSteps}>
            <LaunchStep
              icon={<FileText size={17} />}
              label="1"
              title="Upload your documents"
              value={`${starterReadiness.completed}/${starterReadiness.total} AI ready`}
            />
            <LaunchStep
              icon={<MessageCircle size={17} />}
              label="2"
              title="AI indexes knowledge"
              value={activeKnowledgeJobs ? "Indexing now" : starterReadiness.completed ? "RAG ready" : "Waiting for docs"}
            />
            <LaunchStep icon={<Code2 size={17} />} label="3" title="Connect the website" value="Widget snippet" />
            <LaunchStep
              icon={<Languages size={17} />}
              label="4"
              title="Set AI personality"
              value={widgetSettings.languages.map((language) => language.toUpperCase()).join(", ")}
            />
          </div>
        </div>

        <div className={styles.starterDetailGrid}>
          <div className={styles.starterSetupColumn}>
            <section className={styles.starterCard}>
              <p className="section-kicker">Documents</p>
              <h3>Upload your knowledge base</h3>
              <div className={styles.knowledgeCoverage}>
                <strong>
                  {starterReadiness.completed}/{starterReadiness.total}
                </strong>
                <span>{starterReadiness.missing ? `${starterReadiness.missing} source types need AI-ready documents` : "Starter knowledge is AI ready"}</span>
              </div>
              <div className={styles.documentChecklist}>
                {starterReadiness.items.map((item) => {
                  const Icon = item.done ? CheckCircle2 : CircleDot;

                  return (
                    <span className={item.done ? styles.documentDone : styles.documentMissing} key={item.id}>
                      <Icon size={15} />
                      {item.title}
                      {!item.done && item.matchedDocuments ? <small>{item.matchedDocuments} in review</small> : null}
                    </span>
                  );
                })}
              </div>
              <div className={activeKnowledgeJobs ? styles.indexingNotice : styles.readyNotice}>
                <CircleDot size={15} />
                {activeKnowledgeJobs ? "AI is indexing your knowledge from background jobs." : "Upload documents from Knowledge Base to improve Concierge answers."}
              </div>
            </section>

            <section className={styles.starterCard}>
              <div className={styles.cardTitleRow}>
                <div>
                  <p className="section-kicker">Personality</p>
                  <h3>AI consultant profile</h3>
                </div>
                <a className={styles.inlineAction} href="#concierge-personality-settings">
                  <Pencil size={15} />
                  Edit
                </a>
              </div>
              <div className={styles.personalityGrid}>
                <Field label="Languages" value={`${widgetSettings.languages.length} active`} />
                <Field label="Tone" value={formatWidgetTone(widgetSettings.tone)} />
              </div>
              <details className={styles.personaDetails}>
                <summary>
                  Language personas
                  <span>{widgetSettings.languages.map((language) => language.toUpperCase()).join(", ")}</span>
                </summary>
                <div className={styles.personaSummaryList}>
                  {widgetSettings.languages.map((language) => (
                    <span key={language}>
                      <strong>{language.toUpperCase()}</strong>
                      {widgetSettings.aiNames[language] ?? widgetSettings.aiName}
                      <small>{formatPersonaGender(widgetSettings.personaGenders[language])}</small>
                    </span>
                  ))}
                </div>
              </details>
            </section>
          </div>

          <div className={styles.starterSetupColumn}>
            <section className={styles.starterCard}>
              <p className="section-kicker">Widget readiness</p>
              <h3>Concierge can launch when sources are ready</h3>
              <div className={styles.widgetRuntimeStatus} data-status={widgetInstall.readiness.status}>
                <strong>{formatWidgetReadinessStatus(widgetInstall.readiness.status)}</strong>
                <span>{widgetInstall.readiness.nextAction}</span>
              </div>
              <div className={styles.widgetCapabilityList} aria-label="Widget runtime capabilities">
                {widgetInstall.capabilities.map((capability) => (
                  <div className={styles.widgetCapability} data-enabled={String(capability.enabled)} key={capability.label}>
                    {capability.enabled ? <CheckCircle2 size={15} /> : <CircleDot size={15} />}
                    <strong>{capability.label}</strong>
                  </div>
                ))}
              </div>
              <details className={styles.widgetReadinessDetails}>
                <summary>
                  Readiness checks
                  <span>
                    {widgetLaunchReadiness.completed}/{widgetLaunchReadiness.total} ready
                  </span>
                </summary>
                <div className={styles.widgetReadinessList}>
                  {widgetLaunchReadinessItems.map((item) => (
                    <ReadinessCard item={item} key={item.label} />
                  ))}
                </div>
              </details>
            </section>

            <section className={styles.starterCard}>
              <p className="section-kicker">Widget</p>
              <div className={styles.widgetHeader}>
                <h3>Copy this code</h3>
                <CopyWidgetSnippetButton snippet={widgetInstall.snippet} />
              </div>
              <pre className={styles.widgetSnippet}>{widgetInstall.snippet}</pre>
              <details className={styles.widgetReadinessDetails}>
                <summary>
                  Snippet summary
                  <span>{widgetInstall.dataAttributes.length} attributes</span>
                </summary>
                <div className={styles.widgetAttributeList} aria-label="Widget snippet attributes">
                  {widgetInstall.dataAttributes.map((attribute) => (
                    <div className={styles.widgetAttribute} key={attribute.label}>
                      <span>{attribute.label}</span>
                      <strong>{attribute.value}</strong>
                    </div>
                  ))}
                </div>
              </details>
              <details className={styles.widgetReadinessDetails}>
                <summary>
                  Localized page snippets
                  <span>{localizedWidgetSnippets.length} variants</span>
                </summary>
                <div className={styles.localeInstallList} aria-label="Widget locale integration options">
                  {localizedWidgetSnippets.map((option) => (
                    <div className={styles.localeInstallOption} key={option.label}>
                      <div>
                        <span>{option.label}</span>
                        <CopyWidgetSnippetButton label="Copy" snippet={option.snippet} />
                      </div>
                      <code>{option.value}</code>
                      <small>{option.note}</small>
                    </div>
                  ))}
                  <div className={styles.localeInstallHint}>
                    Use these only when the agency site has separate localized pages. The default snippet already uses auto locale.
                  </div>
                </div>
              </details>
              <WidgetInstallCheckForm defaultUrl={tenant.customDomain ? `https://${tenant.customDomain}` : undefined} />
              <details className={styles.widgetReadinessDetails}>
                <summary>
                  Install prerequisites
                  <span>
                    {widgetInstallStepSummary.completed}/{widgetInstallStepSummary.total} ready
                  </span>
                </summary>
                <div className={styles.widgetInstallSteps}>
                  {widgetInstall.steps.map((step) => (
                    <ReadinessCard item={step} key={step.label} />
                  ))}
                </div>
              </details>
              <small>Starter mode answers from documents and listings. Growth mode creates leads when visitors request help.</small>
            </section>

          </div>
        </div>

        <div className={styles.planModes}>
          <PlanMode label="Starter" note="Documents, Knowledge Base, AI answers, and website widget." />
          <PlanMode label="Growth" note="Conversations become leads when visitors ask for viewings, callbacks, or follow-up." />
          <PlanMode label="Enterprise" note="CRM, analytics, automations, staff roles, SLA, pipeline, and integrations." />
        </div>
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Tenant profile</p>
              <h2 className={styles.panelTitle}>Workspace identity</h2>
            </div>
            <SlidersHorizontal size={20} />
          </div>
          <div className={styles.fieldGrid}>
            <Field label="Tenant ID" value={tenant.id} />
            <Field label="Slug" value={tenant.slug} />
            <Field label="Primary market" value={tenant.primaryMarket ?? "not set"} />
            <Field label="Created" value={formatDate(tenant.createdAt)} />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Branding</p>
              <h2 className={styles.panelTitle}>Agency presence</h2>
            </div>
            <Palette size={20} />
          </div>
          <div className={styles.brandRow}>
            <span
              aria-label="Primary brand color"
              className={styles.swatch}
              style={{ background: tenant.branding.primaryColor ?? "#0f766e" }}
            />
            <div>
              <strong>{tenant.branding.displayName}</strong>
              <span>{tenant.branding.primaryColor ?? "default teal"}</span>
            </div>
          </div>
          <div className={styles.fieldGrid}>
            <Field label="Custom domain" value={tenant.customDomain ?? "not configured"} />
            <Field label="Domain status" value={formatDomainStatus(tenant.domainStatus)} />
            <Field label="Logo URL" value={tenant.branding.logoUrl ?? "not configured"} />
          </div>
        </section>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Launch readiness</p>
            <h2 className={styles.panelTitle}>Workspace setup checklist</h2>
          </div>
          <span className={styles.statusBadge}>
            {completedReadiness}/{readinessItems.length} ready
          </span>
        </div>
        <div className={styles.readinessGrid}>
          {readinessItems.map((item) => (
            <ReadinessCard item={item} key={item.label} />
          ))}
        </div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Editable setup</p>
            <h2 className={styles.panelTitle}>Update workspace settings</h2>
          </div>
          <SlidersHorizontal size={20} />
        </div>

        <UpdateTenantSettingsForm saved={saved} tenant={tenant} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">Limits</p>
            <h2 className={styles.panelTitle}>Usage this billing period</h2>
          </div>
          <span className={styles.statusBadge}>Updated {formatDate(usage.generatedAt)}</span>
        </div>
        <div className={styles.usageGrid}>
          {usage.items.map((item) => (
            <UsageCard item={item} key={item.key} />
          ))}
        </div>
      </section>

      <section className={styles.layout}>
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Access model</p>
              <h2 className={styles.panelTitle}>Role matrix</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <div className={styles.roleList}>
            <RoleRow label="Agent" scope="Own leads, assigned listings, Concierge follow-up" />
            <RoleRow label="Broker" scope="Team inventory, lead assignment, publishing controls" />
            <RoleRow label="Manager" scope="Settings, analytics, AI tools, integrations" />
            <RoleRow label="Admin" scope="Tenant administration and platform-level controls" />
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Integrations</p>
              <h2 className={styles.panelTitle}>API readiness</h2>
            </div>
            <KeyRound size={20} />
          </div>
          <div className={styles.integrationList}>
            <IntegrationRow label="Public property API" status="ready" />
            <IntegrationRow label="Public lead capture API" status="ready" />
            <IntegrationRow label="S3/MinIO media storage" status="configured" />
            <IntegrationRow label="OpenSearch indexing" status="configured" />
            <IntegrationRow label="WebSocket realtime" status="enabled" />
          </div>
        </section>
      </section>
    </>
  );
}

interface ReadinessItem {
  done: boolean;
  label: string;
  note: string;
}

function LaunchStep({
  icon,
  label,
  title,
  value
}: {
  icon: ReactNode;
  label: string;
  title: string;
  value: string;
}) {
  return (
    <article className={styles.launchStep}>
      <span>{label}</span>
      {icon}
      <strong>{title}</strong>
      <small>{value}</small>
    </article>
  );
}

function PlanMode({ label, note }: { label: string; note: string }) {
  return (
    <article className={styles.planMode}>
      <strong>{label}</strong>
      <span>{note}</span>
    </article>
  );
}

function ReadinessCard({ item }: { item: ReadinessItem }) {
  const Icon = item.done ? CheckCircle2 : ShieldAlert;

  return (
    <article className={`${styles.readinessCard} ${item.done ? styles.readinessDone : styles.readinessAction}`}>
      <Icon size={18} />
      <div>
        <strong>{item.label}</strong>
        <span>{item.note}</span>
      </div>
    </article>
  );
}

function KpiCard({
  icon,
  label,
  note,
  value
}: {
  icon: ReactNode;
  label: string;
  note: string;
  value: number | string;
}) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatWidgetTone(tone: string) {
  const labels: Record<string, string> = {
    concise: "Concise",
    friendly: "Friendly",
    luxury: "Luxury",
    professional: "Professional"
  };

  return labels[tone] ?? tone;
}

function formatWidgetReadinessStatus(status: string) {
  const labels: Record<string, string> = {
    "needs-setup": "Needs setup",
    ready: "Ready",
    "test-mode": "Test mode"
  };

  return labels[status] ?? status;
}

function formatPersonaGender(gender?: string) {
  const labels: Record<string, string> = {
    feminine: "feminine voice",
    masculine: "masculine voice",
    neutral: "neutral voice"
  };

  return labels[gender ?? "neutral"] ?? "neutral voice";
}

function UsageCard({ item }: { item: TenantUsageMetric }) {
  return (
    <article className={styles.usageCard}>
      <div className={styles.usageTop}>
        <span>{formatUsageKey(item.key)}</span>
        <strong>{formatPercent(item.utilizationRate)}</strong>
      </div>
      <div className={styles.usageTrack}>
        <span style={{ width: `${Math.min(100, item.utilizationRate)}%` }} />
      </div>
      <small>
        {formatNumber(item.used)} used / {formatNumber(item.limit)} limit
      </small>
    </article>
  );
}

function RoleRow({ label, scope }: { label: string; scope: string }) {
  return (
    <div className={styles.roleRow}>
      <BadgeCheck size={16} />
      <strong>{label}</strong>
      <span>{scope}</span>
    </div>
  );
}

function IntegrationRow({ label, status }: { label: string; status: string }) {
  return (
    <div className={styles.integrationRow}>
      <CircleDot size={16} />
      <strong>{label}</strong>
      <span>{status}</span>
    </div>
  );
}

function getUsage(items: TenantUsageMetric[], key: TenantUsageMetric["key"]) {
  return items.find((item) => item.key === key);
}

function formatUsage(item?: TenantUsageMetric) {
  return item ? `${formatNumber(item.used)}/${formatNumber(item.limit)}` : "n/a";
}

function formatUsageKey(value: TenantUsageMetric["key"]) {
  const labels = {
    agents: "Agent seats",
    aiCreditsMonthly: "AI credits",
    properties: "Properties",
    publicApiRequestsMonthly: "Public API"
  } satisfies Record<TenantUsageMetric["key"], string>;

  return labels[value];
}

function formatDomainStatus(value: TenantSnapshot["domainStatus"]) {
  return value ? value.replaceAll("-", " ") : "not configured";
}

function buildReadinessItems(tenant: TenantSnapshot, usage: TenantUsageResponse): ReadinessItem[] {
  const propertyUsage = getUsage(usage.items, "properties");
  const agentUsage = getUsage(usage.items, "agents");
  const apiUsage = getUsage(usage.items, "publicApiRequestsMonthly");

  return [
    {
      done: Boolean(tenant.branding.displayName && tenant.branding.primaryColor),
      label: "Brand identity",
      note: tenant.branding.logoUrl ? "Display name, color, and logo are configured." : "Add a logo when the agency brand is ready."
    },
    {
      done: tenant.domainStatus === "verified",
      label: "Client domain",
      note: tenant.customDomain
        ? `Domain ${tenant.customDomain} is ${formatDomainStatus(tenant.domainStatus)}.`
        : "Add a custom domain before a public client launch."
    },
    {
      done: Boolean(propertyUsage && propertyUsage.used > 0 && propertyUsage.utilizationRate < 90),
      label: "Inventory capacity",
      note: propertyUsage
        ? `${formatNumber(propertyUsage.used)} of ${formatNumber(propertyUsage.limit)} listings used.`
        : "Property usage is not available yet."
    },
    {
      done: Boolean(agentUsage && agentUsage.used > 0 && agentUsage.utilizationRate < 95),
      label: "Team seats",
      note: agentUsage
        ? `${formatNumber(agentUsage.used)} of ${formatNumber(agentUsage.limit)} agent seats used.`
        : "Agent seat usage is not available yet."
    },
    {
      done: Boolean(apiUsage && apiUsage.utilizationRate < 80),
      label: "Integration headroom",
      note: apiUsage
        ? `${formatNumber(apiUsage.remaining)} public API calls remain this period.`
        : "Public API usage is not available yet."
    }
  ];
}

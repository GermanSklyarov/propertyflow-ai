import {
  ArrowRight,
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
import type { NotificationActionResult } from "@features/tenant-settings-update/ui/tenant-lead-notification-fields";
import { UpdateTenantSettingsForm } from "@features/tenant-settings-update/ui/update-tenant-settings-form";
import { countRunningKnowledgeJobs } from "@entities/jobs/model/background-jobs";
import { buildKnowledgeStarterReadiness } from "@entities/knowledge/model/knowledge-starter-readiness";
import type {
  BackgroundJobMonitorItem,
  KnowledgeDocumentSnapshot,
  TenantSnapshot,
  TenantUsageMetric,
  TenantUsageResponse
} from "@propertyflow/contracts";
import { getTenantWidgetSettings, leadQualificationFieldOptions } from "@entities/tenant/model/widget-settings";
import { formatDate, formatNumber, formatPercent } from "@shared/lib/formatters";
import {
  buildWidgetInstallPackage,
  buildWidgetLaunchReadinessItems,
  buildWidgetPlanUpgradePath,
  summarizeWidgetInstallSteps,
  summarizeWidgetLaunchReadiness
} from "../model/widget-install";
import {
  buildTenantSettingsIntegrationStatuses,
  buildTenantSettingsReadinessItems,
  buildTenantSettingsRoleScopes,
  type TenantSettingsReadinessItem
} from "../model/tenant-settings-readiness";
import { CopyWidgetSnippetButton } from "./copy-widget-snippet-button";
import styles from "./tenant-settings-panel.module.css";
import { WidgetProductionCheckPanel } from "./widget-production-check-panel";

export function TenantSettingsPanel({
  knowledgeDocuments,
  knowledgeJobs,
  notificationResult,
  saved,
  tenant,
  usage
}: {
  knowledgeDocuments: KnowledgeDocumentSnapshot[];
  knowledgeJobs: BackgroundJobMonitorItem[];
  notificationResult?: NotificationActionResult;
  saved?: boolean;
  tenant: TenantSnapshot;
  usage: TenantUsageResponse;
}) {
  const readinessItems = buildTenantSettingsReadinessItems(tenant, usage);
  const completedReadiness = readinessItems.filter((item) => item.done).length;
  const roleScopes = buildTenantSettingsRoleScopes(tenant.subscriptionPlan);
  const integrationStatuses = buildTenantSettingsIntegrationStatuses(tenant, usage);
  const activeKnowledgeJobCount = countRunningKnowledgeJobs(knowledgeJobs);
  const activeKnowledgeJobs = activeKnowledgeJobCount > 0;
  const starterReadiness = buildKnowledgeStarterReadiness(knowledgeDocuments, activeKnowledgeJobCount);
  const widgetInstall = buildWidgetInstallPackage(tenant);
  const widgetPlanUpgradePath = buildWidgetPlanUpgradePath(tenant.subscriptionPlan);
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
  const conciergeCheckLocale = widgetSettings.languages[0] ?? "en";
  const defaultWidgetPageUrl = tenant.customDomain ? `https://${tenant.customDomain}` : widgetSettings.allowedOrigins[0];
  const planUsageItems = getPlanUsageItems(tenant.subscriptionPlan, usage.items);
  const leadQualificationLabels = leadQualificationFieldOptions
    .filter((field) => widgetSettings.leadQualificationFields.includes(field.value))
    .map((field) => field.label);

  return (
    <>
      <section className={styles.kpiGrid} aria-label="Tenant settings overview">
        <KpiCard icon={<Building2 size={18} />} label="Plan" note="Subscription tier" value={tenant.subscriptionPlan} />
        <KpiCard icon={<Globe2 size={18} />} label="Domain" note={tenant.customDomain ?? "Not configured"} value={formatDomainStatus(tenant.domainStatus)} />
        <KpiCard icon={<Users size={18} />} label="Agents" note="Seats used" value={formatUsage(getUsage(usage.items, "agents"))} />
        <KpiCard icon={<Code2 size={18} />} label="Concierge API" note="Requests this month" value={formatUsage(getUsage(usage.items, "publicApiRequestsMonthly"))} />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <p className="section-kicker">AI Concierge Starter</p>
            <h2 className={styles.panelTitle}>Launch AI before CRM</h2>
          </div>
          <div className={styles.headerActions}>
            <a className={styles.inlineAction} href="/setup">
              <Rocket size={15} />
              Setup guide
            </a>
            <span className={styles.statusBadge}>Knowledge first</span>
          </div>
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
            <section className={styles.starterCard} id="widget-install">
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
                  <p className="section-kicker">Lead qualification</p>
                  <h3>AI collects the right details</h3>
                </div>
                <a className={styles.inlineAction} href="#lead-qualification-settings">
                  <Pencil size={15} />
                  Edit
                </a>
              </div>
              <div className={styles.qualificationSummary}>
                {leadQualificationLabels.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <small>
                {leadQualificationLabels.length
                  ? `${leadQualificationLabels.length} fields are enabled for natural follow-up prompts.`
                  : "No lead qualification fields are enabled yet."}
              </small>
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
                <div className={styles.widgetHeaderActions}>
                  <CopyWidgetSnippetButton snippet={widgetInstall.snippet} />
                  <a className={styles.inlineAction} href="/widget-demo">
                    Preview
                    <ArrowRight size={14} />
                  </a>
                </div>
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
              <WidgetProductionCheckPanel defaultWidgetPageUrl={defaultWidgetPageUrl} locale={conciergeCheckLocale} tenantSlug={tenant.slug} />
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

        <PlanUpgradePath path={widgetPlanUpgradePath} />

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

        <UpdateTenantSettingsForm notificationResult={notificationResult} saved={saved} tenant={tenant} />
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
          {planUsageItems.map((item) => (
            <UsageCard item={item} key={item.key} />
          ))}
        </div>
      </section>

      <section className={styles.layout}>
        {roleScopes.length ? (
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Access model</p>
                <h2 className={styles.panelTitle}>Role matrix</h2>
              </div>
              <ShieldCheck size={20} />
            </div>
            <div className={styles.roleList}>
              {roleScopes.map((role) => (
                <RoleRow label={role.label} scope={role.scope} key={role.label} />
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Starter services</p>
              <h2 className={styles.panelTitle}>Launch signals</h2>
            </div>
            <KeyRound size={20} />
          </div>
          <div className={styles.integrationList}>
            {integrationStatuses.map((integration) => (
              <IntegrationRow label={integration.label} status={integration.status} key={integration.label} />
            ))}
          </div>
        </section>
      </section>
    </>
  );
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

function PlanUpgradePath({ path }: { path: ReturnType<typeof buildWidgetPlanUpgradePath> }) {
  return (
    <article className={styles.planUpgradePath} id="plan-upgrade">
      <div className={styles.planUpgradeHeader}>
        <div>
          <p className="section-kicker">Upgrade path</p>
          <h3>{path.title}</h3>
          <span>{path.note}</span>
        </div>
        <div className={styles.planUpgradeBadge} aria-label="Plan transition">
          <strong>{path.currentPlanName}</strong>
          {path.nextPlanName ? (
            <>
              <span>to</span>
              <strong>{path.nextPlanName}</strong>
            </>
          ) : (
            <span>active</span>
          )}
        </div>
      </div>
      <div className={styles.planUpgradeTrigger}>{path.trigger}</div>
      <div className={styles.planUpgradeFeatures}>
        {path.features.map((feature) => (
          <span key={feature.label}>
            <CheckCircle2 size={15} />
            <strong>{feature.label}</strong>
            <small>{feature.note}</small>
          </span>
        ))}
      </div>
      {path.actionHref && path.actionLabel ? (
        <a className={styles.planUpgradeAction} href={path.actionHref}>
          {path.actionLabel}
          <ArrowRight size={16} />
        </a>
      ) : null}
    </article>
  );
}

function ReadinessCard({ item }: { item: TenantSettingsReadinessItem }) {
  const Icon = item.done ? CheckCircle2 : ShieldAlert;

  return (
    <article className={`${styles.readinessCard} ${item.done ? styles.readinessDone : styles.readinessAction}`}>
      <Icon size={18} />
      <div>
        <strong>{item.label}</strong>
        <span>{item.note}</span>
        {!item.done && item.actionHref && item.actionLabel ? (
          <a className={styles.readinessLink} href={item.actionHref}>
            {item.actionLabel}
          </a>
        ) : null}
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
  const hint = formatUsageHint(item.key);

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
        {hint ? <em>{hint}</em> : null}
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
    aiListings: "AI listings",
    agents: "Agent seats",
    aiCreditsMonthly: "AI credits",
    properties: "CRM properties",
    publicApiRequestsMonthly: "Concierge API"
  } satisfies Record<TenantUsageMetric["key"], string>;

  return labels[value];
}

function formatUsageHint(value: TenantUsageMetric["key"]) {
  const labels = {
    aiListings: "Listings indexed for Concierge search and answers.",
    agents: undefined,
    aiCreditsMonthly: undefined,
    properties: "CRM inventory records, separate from Concierge AI listings.",
    publicApiRequestsMonthly: undefined
  } satisfies Record<TenantUsageMetric["key"], string | undefined>;

  return labels[value];
}

function getPlanUsageItems(plan: TenantSnapshot["subscriptionPlan"], items: TenantUsageMetric[]) {
  const keys =
    plan === "starter"
      ? (["aiListings", "aiCreditsMonthly", "publicApiRequestsMonthly"] satisfies TenantUsageMetric["key"][])
      : (["properties", "agents", "aiCreditsMonthly", "publicApiRequestsMonthly"] satisfies TenantUsageMetric["key"][]);

  return keys.map((key) => getUsage(items, key)).filter((item): item is TenantUsageMetric => Boolean(item));
}

function formatDomainStatus(value: TenantSnapshot["domainStatus"]) {
  return value ? value.replaceAll("-", " ") : "not configured";
}

import type {
  SuperAdminAgencyDrilldown,
  SuperAdminDashboardResponse,
  SuperAdminMetricCard,
  SuperAdminSystemHealth
} from "@propertyflow/contracts";
import {
  Activity,
  AlertTriangle,
  Bot,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  MapPinned,
  MessageSquareText,
  RadioTower,
  Server,
  Users
} from "lucide-react";
import { formatAdminMetric, formatAdminMoney, selectActionableLimitAlerts, superAdminSections } from "../../../admin-capabilities";

interface SuperAdminDashboardPageProps {
  dashboard: SuperAdminDashboardResponse;
  isDemo: boolean;
  loadError?: string;
}

const metricIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  activeAgencies: Building2,
  conciergeConversations: MessageSquareText,
  aiMessagesRequests: Bot,
  leadsGenerated: Users,
  qualifiedLeads: CheckCircle2,
  llmTokensUsed: Activity,
  estimatedAiCost: CircleDollarSign,
  googleMapsRequests: MapPinned,
  messengerNotifications: RadioTower,
  totalEstimatedInfrastructureCost: Server,
  costPerAgencyMonth: Gauge
};

export function SuperAdminDashboardPage({ dashboard, isDemo, loadError }: SuperAdminDashboardPageProps) {
  const alerts = selectActionableLimitAlerts(dashboard);
  const primaryAgency = dashboard.agencies[0];

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#17211f]">
      <div className="mx-auto flex w-full max-w-[1480px] gap-6 px-5 py-5 lg:px-8">
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-5 border-r border-[#d8d2c4] pr-5">
            <div className="mb-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#7a6f5f]">PropertyFlowAI</p>
              <h1 className="mt-2 text-2xl font-semibold text-[#17211f]">Super Admin</h1>
            </div>
            <nav className="space-y-1">
              {superAdminSections.map((section, index) => (
                <a
                  className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
                    index === 0 ? "bg-[#17211f] text-white" : "text-[#554d43] hover:bg-[#ece7dd]"
                  }`}
                  href={`#${section.toLowerCase().replaceAll(" ", "-").replace("&", "and")}`}
                  key={section}
                >
                  <span>{section}</span>
                  {index === 0 ? <span className="h-2 w-2 rounded-full bg-[#f2b36d]" /> : null}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-5 flex flex-col gap-4 border-b border-[#d8d2c4] pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-[#17211f] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                  Starter pilot
                </span>
                {isDemo ? <span className="rounded-md bg-[#ffe1bd] px-2.5 py-1 text-xs font-semibold text-[#6a3d12]">Demo data</span> : null}
              </div>
              <h2 className="mt-3 text-3xl font-semibold text-[#17211f] md:text-4xl">Usage, cost, and ROI</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#675f55]">
                {formatDate(dashboard.periodStart)} to {formatDate(dashboard.periodEnd)}. Generated {formatDateTime(dashboard.generatedAt)}.
              </p>
            </div>
            <div className="flex gap-2">
              <StatusPill label="API" value={dashboard.systemHealth.api} />
              <StatusPill label="PostgreSQL" value={dashboard.systemHealth.postgresql} />
            </div>
          </header>

          {loadError ? (
            <div className="mb-5 rounded-md border border-[#dfb15f] bg-[#fff8e8] px-4 py-3 text-sm text-[#65420f]">
              Showing demo data because the live dashboard could not load: {loadError}
            </div>
          ) : null}

          <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" id="overview">
            {dashboard.cards.map((card) => (
              <MetricCard card={card} key={card.key} />
            ))}
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]" id="usage-and-costs">
            <Panel title="Cost per agency / month">
              <div className="space-y-3">
                {dashboard.agencyCosts.map((agency) => (
                  <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-[#e2dccc] pb-3 last:border-b-0 last:pb-0" key={agency.tenantId}>
                    <div>
                      <p className="font-medium text-[#17211f]">{agency.agencyName}</p>
                      <p className="text-xs uppercase tracking-[0.12em] text-[#82786a]">{agency.subscriptionPlan}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-[#17211f]">{formatAdminMoney(agency.estimatedCostUsd)}</p>
                      <p className="text-xs text-[#82786a]">
                        {agency.costPerQualifiedLeadUsd === undefined ? "No qualified leads" : `${formatAdminMoney(agency.costPerQualifiedLeadUsd)} / qualified lead`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Limits & alerts">
              {alerts.length ? (
                <div className="space-y-3">
                  {alerts.map((alert) => (
                    <div className="rounded-md border border-[#e5c271] bg-[#fff8e8] p-3" key={`${alert.tenantId}-${alert.metric}`}>
                      <div className="flex items-center gap-2 text-sm font-semibold text-[#5f4217]">
                        <AlertTriangle className="h-4 w-4" />
                        {alert.agencyName} reached {alert.utilizationRate}%
                      </div>
                      <Progress value={alert.utilizationRate} />
                      <p className="mt-1 text-xs text-[#7a6f5f]">
                        {alert.metric}: {formatNumber(alert.used)} / {formatNumber(alert.limit)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="No active alerts" copy="All Starter tenants are below 70% of tracked usage limits." />
              )}
            </Panel>
          </section>

          <section className="mt-6" id="ai-usage">
            <Panel title="AI Usage">
              <ResponsiveTable
                columns={["Agency", "Conversations", "LLM requests", "Input tokens", "Output tokens", "Estimated cost"]}
                rows={dashboard.aiUsage.map((row) => [
                  row.agencyName,
                  formatNumber(row.conversations),
                  formatNumber(row.llmRequests),
                  compact(row.inputTokens),
                  compact(row.outputTokens),
                  formatAdminMoney(row.estimatedCostUsd)
                ])}
              />
            </Panel>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2" id="integrations">
            <Panel title="Maps / Geocoding">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Geocoding" value={`${formatNumber(dashboard.maps.geocodingRequests)} / ${formatNumber(dashboard.maps.freeTierUsage.geocoding.limit)} free`} />
                <MiniStat label="Places" value={formatNumber(dashboard.maps.placesRequests)} />
                <MiniStat label="Cache hits" value={formatNumber(dashboard.maps.cacheHits)} />
                <MiniStat label="Cache misses" value={formatNumber(dashboard.maps.cacheMisses)} />
              </div>
              <div className="mt-4">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">Cache hit rate</span>
                  <span>{dashboard.maps.cacheHitRate}%</span>
                </div>
                <Progress value={dashboard.maps.cacheHitRate} />
              </div>
            </Panel>

            <Panel title="Messaging">
              <div className="grid grid-cols-2 gap-3">
                <MiniStat label="Notifications" value={formatNumber(dashboard.messaging.notifications)} />
                <MiniStat label="Delivery errors" value={formatNumber(dashboard.messaging.deliveryErrors)} />
                <MiniStat label="Telegram sent / failed" value={`${dashboard.messaging.telegramSent} / ${dashboard.messaging.telegramFailed}`} />
                <MiniStat label="LINE sent / failed" value={`${dashboard.messaging.lineSent} / ${dashboard.messaging.lineFailed}`} />
                <MiniStat label="WhatsApp sent / failed" value={`${dashboard.messaging.whatsappSent} / ${dashboard.messaging.whatsappFailed}`} />
              </div>
            </Panel>
          </section>

          <section className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-[0.9fr_1.1fr]" id="agencies">
            <AgencyDrilldown agency={primaryAgency} />
            <Panel title="Spend by function">
              <div className="space-y-3">
                {dashboard.usageByOperation.length ? (
                  dashboard.usageByOperation.map((item) => (
                    <div key={`${item.service}-${item.operation}`}>
                      <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                        <span className="font-medium text-[#17211f]">{item.service} · {item.operation}</span>
                        <span className="text-[#675f55]">{formatAdminMoney(item.estimatedCostUsd)}</span>
                      </div>
                      <Progress value={item.costSharePercent} />
                    </div>
                  ))
                ) : (
                  <EmptyState title="No usage events yet" copy="Costs will appear after AI, Maps, and messaging calls start writing usage events." />
                )}
              </div>
            </Panel>
          </section>

          <section className="mt-6" id="system-health">
            <Panel title="System Health">
              <HealthGrid health={dashboard.systemHealth} />
            </Panel>
          </section>
        </section>
      </div>
    </main>
  );
}

function MetricCard({ card }: { card: SuperAdminMetricCard }) {
  const Icon = metricIcons[card.key] ?? Activity;
  const formatted = formatAdminMetric(card);

  return (
    <article className="rounded-md border border-[#d8d2c4] bg-[#fffdf8] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#675f55]">{card.label}</p>
        <span className="grid h-8 w-8 place-items-center rounded-md bg-[#e9f0df] text-[#315742]">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold text-[#17211f]">{formatted.month}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#82786a]">Today {formatted.today}</p>
    </article>
  );
}

function Panel({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="rounded-md border border-[#d8d2c4] bg-[#fffdf8] p-4">
      <h3 className="mb-4 text-base font-semibold text-[#17211f]">{title}</h3>
      {children}
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[#e2dccc] bg-[#faf7ef] p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-[#82786a]">{label}</p>
      <p className="mt-1 text-lg font-semibold text-[#17211f]">{value}</p>
    </div>
  );
}

function AgencyDrilldown({ agency }: { agency?: SuperAdminAgencyDrilldown }) {
  if (!agency) {
    return (
      <Panel title="Agency drill-down">
        <EmptyState title="No agencies yet" copy="Provision a Starter tenant to see usage and ROI." />
      </Panel>
    );
  }

  return (
    <Panel title={`Agencies · ${agency.agencyName}`}>
      <div className="grid grid-cols-2 gap-3">
        <MiniStat label="Conversations" value={formatNumber(agency.usageThisMonth.conversations)} />
        <MiniStat label="AI requests" value={formatNumber(agency.usageThisMonth.aiRequests)} />
        <MiniStat label="Tokens" value={compact(agency.usageThisMonth.tokens)} />
        <MiniStat label="Estimated cost" value={formatAdminMoney(agency.usageThisMonth.estimatedCostUsd)} />
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2 text-center">
        <FunnelStep label="Visitors" value={agency.roi.visitors === undefined ? "—" : formatNumber(agency.roi.visitors)} />
        <FunnelStep label="Conversations" value={formatNumber(agency.roi.conversations)} />
        <FunnelStep label="Leads" value={formatNumber(agency.roi.leads)} />
        <FunnelStep label="Qualified" value={formatNumber(agency.roi.qualifiedLeads)} />
      </div>
    </Panel>
  );
}

function FunnelStep({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-[#e9f0df] p-3">
      <p className="text-lg font-semibold text-[#17211f]">{value}</p>
      <p className="mt-1 text-xs text-[#5c6757]">{label}</p>
    </div>
  );
}

function HealthGrid({ health }: { health: SuperAdminSystemHealth }) {
  const items = [
    ["API", health.api],
    ["PostgreSQL", health.postgresql],
    ["Redis", health.redis],
    ["LLM provider", health.llmProvider],
    ["Google Maps", health.googleMaps],
    ["Telegram", health.telegram],
    ["LINE", health.line],
    ["WhatsApp", health.whatsapp],
    ["Failed jobs", formatNumber(health.failedJobs)],
    ["Webhook failures", formatNumber(health.webhookFailures)],
    ["Failed notifications", formatNumber(health.failedNotifications)],
    ["Error rate", `${health.errorRate}%`]
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([label, value]) => (
        <MiniStat key={label} label={label} value={value} />
      ))}
    </div>
  );
}

function ResponsiveTable({ columns, rows }: { columns: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#d8d2c4] text-left text-xs uppercase tracking-[0.12em] text-[#82786a]">
            {columns.map((column) => (
              <th className="px-3 py-2 font-semibold" key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-b border-[#eee8dc] last:border-b-0" key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td className="px-3 py-3 text-[#17211f]" key={`${rowIndex}-${cellIndex}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e4ded1]">
      <div className="h-full rounded-full bg-[#3d7a5d]" style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}

function EmptyState({ copy, title }: { copy: string; title: string }) {
  return (
    <div className="rounded-md border border-dashed border-[#d8d2c4] bg-[#faf7ef] p-4">
      <p className="font-medium text-[#17211f]">{title}</p>
      <p className="mt-1 text-sm text-[#675f55]">{copy}</p>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: string }) {
  const ok = value === "ok";

  return (
    <span className={`rounded-md px-3 py-1.5 text-xs font-semibold ${ok ? "bg-[#e9f0df] text-[#315742]" : "bg-[#eee8dc] text-[#675f55]"}`}>
      {label}: {value}
    </span>
  );
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function compact(value: number): string {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, notation: "compact" }).format(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(value));
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(value));
}

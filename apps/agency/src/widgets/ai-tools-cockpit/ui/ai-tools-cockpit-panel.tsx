import { Bot, Camera, FileText, ImagePlus, Languages, LockKeyhole, ShieldCheck, Sparkles, TrendingUp, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import type { TenantDashboardMetrics } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./ai-tools-cockpit-panel.module.css";

interface AssistantResult {
  jobs: number;
  policyItems: number;
  property: string;
  propertyId?: string;
}

export function AiToolsCockpitPanel({
  assistantResult,
  metrics,
  readyCount,
  reviewCount
}: {
  assistantResult?: AssistantResult;
  metrics: TenantDashboardMetrics;
  readyCount: number;
  reviewCount: number;
}) {
  return (
    <>
      <section className={styles.kpiGrid} aria-label="AI tools overview">
        <KpiCard icon={<Sparkles size={18} />} label="AI-ready listings" note="Enough structured data" value={readyCount} />
        <KpiCard icon={<TriangleAlert size={18} />} label="Needs review" note="Human approval first" value={reviewCount} />
        <KpiCard icon={<ShieldCheck size={18} />} label="Blocked actions" note="Policy layer" value={metrics.security.blockedAiActions} />
        <KpiCard icon={<TrendingUp size={18} />} label="Pricing rows" note="Training dataset" value={metrics.conciergeTrainingDatasetRows} />
      </section>

      {assistantResult ? <AssistantQueuedResult assistantResult={assistantResult} /> : null}

      <section className={styles.layout}>
        <section className={styles.toolsPanel} aria-label="AI tool modules">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Tool modules</p>
              <h2 className={styles.panelTitle}>Agent workflows</h2>
            </div>
            <span className={styles.statusBadge}>MVP preview</span>
          </div>

          <div className={styles.toolGrid}>
            <ToolCard
              icon={<FileText size={19} />}
              title="Listing description"
              copy="Generate polished listing copy from structured fields, amenities, photos, and neighborhood signals."
              status="Ready"
            />
            <ToolCard
              icon={<Languages size={19} />}
              title="Multilingual copy"
              copy="Prepare English, Russian, Thai, and Chinese variants for agency sites and outbound follow-up."
              status="Ready"
            />
            <ToolCard
              icon={<Camera size={19} />}
              title="Image analysis"
              copy="Detect pool, sea view, furniture, renovation quality, air conditioning, and listing photo signals."
              status="Review"
            />
            <ToolCard
              icon={<ImagePlus size={19} />}
              title="Document OCR"
              copy="Extract ownership and parcel details from uploaded documents before an agent approves the result."
              status="Next"
            />
            <ToolCard
              icon={<TrendingUp size={19} />}
              title="Price recommendation"
              copy="Use comparable listings now, then graduate to trained pricing models once feedback coverage grows."
              status="Ready"
            />
            <ToolCard
              icon={<LockKeyhole size={19} />}
              title="Action policy"
              copy="Block destructive or hallucinated AI actions before they touch listings, images, or background jobs."
              status="Live"
            />
          </div>
        </section>

        <aside className={styles.guardrailPanel}>
          <p className="section-kicker">Safety layer</p>
          <h2 className={styles.sideTitle}>AI action policy</h2>
          <div className={styles.guardrailList}>
            {metrics.security.blockedAiActionsByName.map((item) => (
              <div className={styles.guardrailItem} key={item.bucket}>
                <strong>{item.count}</strong>
                <span>{formatBucket(item.bucket)}</span>
              </div>
            ))}
            <div className={styles.guardrailItem}>
              <strong>{metrics.security.imageDeletePreviews}</strong>
              <span>delete previews issued</span>
            </div>
            <div className={styles.guardrailItem}>
              <strong>{metrics.security.rejectedJobEnqueues}</strong>
              <span>jobs rejected</span>
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function AssistantQueuedResult({ assistantResult }: { assistantResult: AssistantResult }) {
  return (
    <section className={styles.resultPanel} id="assistant-result">
      <div className={styles.resultIcon}>
        <Bot size={19} />
      </div>
      <div>
        <p className="section-kicker">Assistant queued</p>
        <h2>{assistantResult.property}</h2>
        <p>
          Created {assistantResult.jobs} background job{assistantResult.jobs === 1 ? "" : "s"} and evaluated{" "}
          {assistantResult.policyItems} policy rule{assistantResult.policyItems === 1 ? "" : "s"}. Keep the worker running, then review
          generated assets on the listing page.
        </p>
        {assistantResult.propertyId ? (
          <div className={styles.resultLinks}>
            <a href={`/listings/${assistantResult.propertyId}#ai-descriptions`}>Review descriptions</a>
            <a href={`/listings/${assistantResult.propertyId}#ai-image-analysis`}>Review image analysis</a>
          </div>
        ) : null}
      </div>
    </section>
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

function ToolCard({
  copy,
  icon,
  status,
  title
}: {
  copy: string;
  icon: ReactNode;
  status: string;
  title: string;
}) {
  return (
    <article className={styles.toolCard}>
      <div className={styles.toolIcon}>{icon}</div>
      <h3>{title}</h3>
      <p>{copy}</p>
      <span>{status}</span>
    </article>
  );
}

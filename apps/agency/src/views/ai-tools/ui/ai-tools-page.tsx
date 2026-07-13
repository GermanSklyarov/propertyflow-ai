import {
  Bot,
  Camera,
  FileText,
  WandSparkles
} from "lucide-react";
import { runListingAssistantAction } from "@entities/listing/api/ai-tools-actions";
import type {
  BackgroundJobMonitorItem,
  BackgroundJobMonitorResponse,
  PropertyAiAssets,
  PropertyImageGalleryResponse,
  TenantDashboardMetrics
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import { AiToolsCockpitPanel } from "@widgets/ai-tools-cockpit/ui/ai-tools-cockpit-panel";
import styles from "./ai-tools-page.module.css";

export function AiToolsPage({
  aiAssets,
  assistantResult,
  galleries,
  jobs,
  listings,
  metrics
}: {
  aiAssets: PropertyAiAssets[];
  assistantResult?: {
    jobs: number;
    policyItems: number;
    property: string;
    propertyId?: string;
  };
  galleries: PropertyImageGalleryResponse[];
  jobs: BackgroundJobMonitorResponse;
  listings: PropertySnapshot[];
  metrics: TenantDashboardMetrics;
}) {
  const aiAssetsByPropertyId = new Map(aiAssets.map((assets) => [assets.propertyId, assets]));
  const galleriesByPropertyId = new Map(galleries.map((gallery) => [gallery.propertyId, gallery]));
  const operations = buildAiOperations(listings, galleriesByPropertyId, aiAssetsByPropertyId);
  const readyCount = operations.filter((operation) => operation.readiness === "ready").length;
  const reviewCount = operations.filter((operation) => operation.readiness === "review").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Agent automation</p>
            <h1 className={styles.title}>AI tools cockpit</h1>
            <p className={styles.subtitle}>
              Prepare listing descriptions, multilingual copy, image analysis, OCR-style extraction, pricing signals, and safe agent actions.
            </p>
          </div>
          <span className={styles.timestamp}>Guardrails active</span>
        </header>

        <AiToolsCockpitPanel
          assistantResult={assistantResult}
          metrics={metrics}
          readyCount={readyCount}
          reviewCount={reviewCount}
        />

        <section className={styles.jobsPanel} aria-label="Background job monitor">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Worker monitor</p>
              <h2 className={styles.panelTitle}>Background jobs</h2>
            </div>
            <span className={styles.statusBadge}>{jobs.total} recent jobs</span>
          </div>

          {jobs.items.length ? (
            <div className={styles.jobList}>
              {jobs.items.map((job) => (
                <JobRow job={job} key={job.id} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyJobs}>
              <Bot size={22} />
              <strong>No recent jobs</strong>
              <p>Run the listing assistant or upload photos with AI analysis enabled. Worker activity will appear here.</p>
            </div>
          )}
        </section>

        <section className={styles.queuePanel} aria-label="AI listing queue">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Listing queue</p>
              <h2 className={styles.panelTitle}>Recommended AI work</h2>
            </div>
            <span className={styles.statusBadge}>{operations.length} listings scanned</span>
          </div>

          <div className={styles.operationList}>
            {operations.map((operation) => (
              <AiOperationRow key={operation.property.id} operation={operation} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

interface AiOperation {
  assets: PropertyAiAssets;
  images: PropertyImageGalleryResponse["images"];
  property: PropertySnapshot;
  readiness: "ready" | "review" | "blocked";
  score: number;
  missing: string[];
  pendingDescriptions: number;
  pendingImageAnalyses: number;
  recommendedActions: string[];
}

function AiOperationRow({ operation }: { operation: AiOperation }) {
  return (
    <article className={styles.operationRow}>
      <div>
        <h3>{operation.property.title}</h3>
        <p>{operation.property.description ?? "No description yet. Start with AI copy generation and human review."}</p>
      </div>

      <div className={styles.actionGroup}>
        {operation.recommendedActions.map((action) => (
          <span key={action}>
            <WandSparkles size={14} />
            {action}
          </span>
        ))}
      </div>

      <div className={styles.reviewGroup}>
        <div className={styles.reviewMetric}>
          <FileText size={14} />
          <strong>{operation.pendingDescriptions}</strong>
          <span>copy drafts</span>
        </div>
        <div className={styles.reviewMetric}>
          <Camera size={14} />
          <strong>{operation.pendingImageAnalyses}</strong>
          <span>image drafts</span>
        </div>
        <a href={`/listings/${operation.property.id}#ai-descriptions`}>Review assets</a>
      </div>

      <div className={styles.operationControls}>
        <form action={runListingAssistantAction} className={styles.runAssistantForm}>
          <input name="propertyId" type="hidden" value={operation.property.id} />
          <input name="title" type="hidden" value={operation.property.title} />
          {operation.images.map((image) => (
            <input key={`${image.id}-url`} name="imageUrls" type="hidden" value={image.imageUrl} />
          ))}
          {operation.images.map((image) => (
            <input key={`${image.id}-id`} name="imageIds" type="hidden" value={image.id} />
          ))}
          <button type="submit">
            <Bot size={14} />
            Run assistant
          </button>
          <small>{operation.images.length ? `${operation.images.length} photos included` : "copy only"}</small>
        </form>

        <div className={styles.operationStatus}>
          <strong>{operation.score}/5</strong>
          <span className={styles[operation.readiness]}>{operation.readiness}</span>
          {operation.missing.length ? (
            <div className={styles.missingGroup} aria-label="Missing listing signals">
              {operation.missing.map((item) => (
                <small key={item}>{item}</small>
              ))}
            </div>
          ) : (
            <small>ready for review</small>
          )}
        </div>
      </div>
    </article>
  );
}

function JobRow({ job }: { job: BackgroundJobMonitorItem }) {
  return (
    <article className={styles.jobRow}>
      <div>
        <strong>{formatJobName(job.name)}</strong>
        <span>{formatJobPayload(job)}</span>
      </div>
      <span className={`${styles.jobState} ${styles[`job-${job.state}`] ?? ""}`}>{formatBucket(job.state)}</span>
      <small>{formatJobTime(job)}</small>
      <small>{job.attemptsMade ? `${job.attemptsMade} attempts` : "first attempt"}</small>
    </article>
  );
}

function formatJobName(name: BackgroundJobMonitorItem["name"]) {
  return name
    .split(".")
    .map((part) => formatBucket(part))
    .join(" / ");
}

function formatJobPayload(job: BackgroundJobMonitorItem) {
  const payload = job.payload;

  if ("propertyId" in payload) {
    const details = [`property ${payload.propertyId.slice(0, 8)}`];

    if ("locales" in payload) {
      details.push(`${payload.locales.length} locales`);
    }

    if ("imageUrls" in payload) {
      details.push(`${payload.imageUrls.length} photos`);
    }

    if ("reason" in payload) {
      details.push(payload.reason);
    }

    return details.join(" · ");
  }

  if ("modelVersion" in payload) {
    return `${payload.modelVersion} · ${payload.algorithm}`;
  }

  if ("documentId" in payload) {
    return payload.documentId ? `document ${payload.documentId.slice(0, 8)}` : "document ingest";
  }

  if ("source" in payload) {
    return formatBucket(payload.source);
  }

  return "tenant scoped job";
}

function formatJobTime(job: BackgroundJobMonitorItem) {
  const timestamp = job.finishedAt ?? job.processedAt ?? job.createdAt;

  if (!timestamp) {
    return "time pending";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(timestamp));
}

function buildAiOperations(
  listings: PropertySnapshot[],
  galleriesByPropertyId: Map<string, PropertyImageGalleryResponse>,
  aiAssetsByPropertyId: Map<string, PropertyAiAssets>
): AiOperation[] {
  return listings.map((property) => {
    const assets = aiAssetsByPropertyId.get(property.id) ?? {
      descriptions: [],
      imageAnalysis: [],
      propertyId: property.id
    };
    const images = [...(galleriesByPropertyId.get(property.id)?.images ?? [])]
      .filter((image) => !image.deletedAt)
      .sort((first, second) => first.position - second.position);
    const pendingDescriptions = assets.descriptions.filter((asset) => asset.reviewStatus === "draft").length;
    const pendingImageAnalyses = assets.imageAnalysis.filter((asset) => asset.reviewStatus === "draft").length;
    const missing = [
      property.description ? undefined : "copy",
      images.length ? undefined : "photos",
      property.amenities.length >= 4 ? undefined : "amenities",
      property.beachDistanceMeters ? undefined : "distance",
      property.monthlyRentEstimate || property.rentalPriceMonthly ? undefined : "rent signal",
      property.maintenanceFeeMonthly ? undefined : "ownership costs"
    ].filter((item): item is string => Boolean(item));
    const score = 5 - missing.length;
    const recommendedActions = [
      !property.description ? "generate description" : "refresh copy",
      images.length ? `analyze ${images.length} photos` : "upload photos",
      property.monthlyRentEstimate || property.rentalPriceMonthly ? "price check" : "rent estimate"
    ];

    return {
      assets,
      images,
      property,
      missing,
      pendingDescriptions,
      pendingImageAnalyses,
      readiness: score >= 4 ? "ready" : score >= 2 ? "review" : "blocked",
      recommendedActions,
      score
    };
  });
}

import { FileSpreadsheet, Upload } from "lucide-react";
import { importPropertiesCsvAction } from "@entities/listing/api/listing-actions";
import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import { ListingBulkImportForm } from "./listing-bulk-import-form";
import styles from "./listing-bulk-import-panel.module.css";

interface ListingBulkImportPanelProps {
  jobs: BackgroundJobMonitorItem[];
  result?: {
    error?: "empty";
    jobId?: string;
  };
}

const templateColumns = [
  "externalId",
  "title",
  "market",
  "kind",
  "listingType",
  "priceThb",
  "rentalPriceMonthlyThb",
  "areaSqm",
  "bedrooms",
  "bathrooms",
  "address",
  "amenities",
  "description"
];

const csvTemplate = [
  templateColumns.join(","),
  [
    "crm-1001",
    "Wongamat Sea View Residence",
    "pattaya",
    "condo",
    "sale_or_rent",
    "3500000",
    "24000",
    "45",
    "1",
    "1",
    "Wongamat Beach, Pattaya",
    "pool|gym|sea view|fiber internet",
    "High-floor condo near the beach with winter rental appeal"
  ]
    .map(csvCell)
    .join(",")
].join("\n");
const csvTemplateHref = `data:text/csv;charset=utf-8,${encodeURIComponent(csvTemplate)}`;

export function ListingBulkImportPanel({ jobs, result }: ListingBulkImportPanelProps) {
  return (
    <section className={styles.panel} id="import-listings">
      <details className={styles.drawer}>
        <summary className={styles.openButton}>
          <span>
            <FileSpreadsheet size={18} />
            Import existing inventory
          </span>
          <small>Move an agency database from CSV into PropertyFlow without manual listing creation.</small>
          <Upload size={18} />
        </summary>

        <div className={styles.body}>
          <div className={styles.copy}>
            <p className="section-kicker">Agency onboarding</p>
            <h2>Bulk listing import</h2>
            <p>
              Upload a CSV exported from an old CRM, spreadsheet, or partner system. Files are stored in object storage and
              imported by a BullMQ worker, so agents can keep working while drafts are created in the background.
            </p>
          </div>

          {result?.jobId ? (
            <div className={styles.success} role="status">
              <strong>Import queued</strong>
              <span>Job {result.jobId}</span>
              <small>Worker progress appears in background jobs. Imported listings will land as drafts.</small>
            </div>
          ) : null}

          {result?.error === "empty" ? (
            <div className={styles.warning} role="alert">
              <strong>No CSV received</strong>
              <span>Upload a file or paste rows before queueing import.</span>
            </div>
          ) : null}

          <ListingBulkImportForm
            action={importPropertiesCsvAction}
            csvTemplateHref={csvTemplateHref}
            templateColumns={templateColumns}
          />

          {jobs.length ? (
            <div className={styles.jobsPanel}>
                <div className={styles.jobsHeader}>
                  <span>Recent import jobs</span>
                  <small>{jobs.length} visible</small>
                </div>
                <div className={styles.jobList}>
                  {jobs.map((job) => {
                    const progress = getImportProgress(job);
                    const result = getImportResult(job);

                    return (
                      <article className={styles.jobCard} key={job.id}>
                        <div className={styles.jobTopline}>
                          <strong>Job {job.id}</strong>
                          <span className={`${styles.jobState} ${styles[`job-${job.state}`] ?? ""}`}>{job.state}</span>
                        </div>
                        <div className={styles.progressTrack} aria-label={`Import progress ${progress.percent}%`}>
                          <span style={{ width: `${progress.percent}%` }} />
                        </div>
                        <div className={styles.jobMeta}>
                          <small>{progress.imported} imported</small>
                          <small>{progress.skipped} skipped</small>
                          <small>{progress.total} total</small>
                          <small>{formatJobTime(job)}</small>
                        </div>
                        {result ? (
                          <div className={styles.resultSummary}>
                            <strong>{result.dryRun ? "Dry-run complete" : "Import complete"}</strong>
                            <span>
                              {result.imported} imported · {result.skipped} skipped · {result.indexed} indexed · {result.total} rows
                            </span>
                          </div>
                        ) : null}
                        {result?.rowsMissingExternalId ? (
                          <div className={styles.importWarning}>
                            <strong>{result.rowsMissingExternalId} rows without externalId</strong>
                            <span>They can create duplicate drafts on recurring CRM imports.</span>
                          </div>
                        ) : null}
                        {result?.issues?.length ? (
                          <div className={styles.issueList}>
                            {result.issues.map((issue) => (
                              <small key={`${job.id}-${issue.rowNumber}-${issue.reason}`}>
                                Row {issue.rowNumber}: {issue.reason}
                              </small>
                            ))}
                          </div>
                        ) : null}
                        {job.failedReason ? <p className={styles.failure}>{job.failedReason}</p> : null}
                      </article>
                    );
                  })}
                </div>
              </div>
          ) : null}
        </div>
      </details>
    </section>
  );
}

function getImportProgress(job: BackgroundJobMonitorItem) {
  const progress = isProgressObject(job.progress) ? job.progress : {};
  const imported = getProgressNumber(progress.imported);
  const skipped = getProgressNumber(progress.skipped);
  const total = getProgressNumber(progress.total);
  const percent =
    getProgressNumber(progress.percent) ||
    (typeof job.progress === "number" ? job.progress : total > 0 ? Math.round(((imported + skipped) / total) * 100) : 0);

  return {
    imported,
    percent: Math.max(0, Math.min(percent, 100)),
    skipped,
    total
  };
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

function getImportResult(job: BackgroundJobMonitorItem): ImportJobResult | undefined {
  if (!isRecord(job.result)) {
    return undefined;
  }

  const imported = getProgressNumber(job.result.imported);
  const skipped = getProgressNumber(job.result.skipped);
  const total = getProgressNumber(job.result.total);
  const indexed = getProgressNumber(job.result.indexed);
  const rowsMissingExternalId = getProgressNumber(job.result.rowsMissingExternalId);
  const rowsWithExternalId = getProgressNumber(job.result.rowsWithExternalId);
  const dryRun = job.result.dryRun === true;
  const issues = Array.isArray(job.result.issues)
    ? job.result.issues.filter(isImportIssue).slice(0, 3)
    : [];

  return { dryRun, imported, indexed, issues, rowsMissingExternalId, rowsWithExternalId, skipped, total };
}

function isProgressObject(value: BackgroundJobMonitorItem["progress"]): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ImportJobResult {
  dryRun: boolean;
  imported: number;
  indexed: number;
  issues: ImportIssue[];
  rowsMissingExternalId: number;
  rowsWithExternalId: number;
  skipped: number;
  total: number;
}

interface ImportIssue {
  reason: string;
  rowNumber: number;
}

function isImportIssue(value: unknown): value is ImportIssue {
  return isRecord(value) && typeof value.reason === "string" && typeof value.rowNumber === "number";
}

function getProgressNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

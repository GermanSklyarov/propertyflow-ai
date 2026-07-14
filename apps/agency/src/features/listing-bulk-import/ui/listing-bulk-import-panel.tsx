import { FileSpreadsheet, Upload } from "lucide-react";
import { importPropertiesCsvAction } from "@entities/listing/api/listing-actions";
import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import { ListingImportJobsPanel } from "./listing-import-jobs-panel";
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
  "projectName",
  "projectStatus",
  "projectDeveloper",
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
    "The Riviera Wongamat",
    "completed",
    "Riviera Group",
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
  const shouldOpen = Boolean(result?.jobId || result?.error || jobs.some((job) => job.state === "active" || job.state === "waiting"));

  return (
    <section className={styles.panel} id="import-listings">
      <details className={styles.drawer} open={shouldOpen}>
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

          <ListingImportJobsPanel initialJobs={jobs} queuedJobId={result?.jobId} />
        </div>
      </details>
    </section>
  );
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`;
}

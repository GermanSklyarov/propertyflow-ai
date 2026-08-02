import { FileSpreadsheet, Upload } from "lucide-react";
import { importPropertiesCsvAction } from "@entities/listing/api/listing-actions";
import { listingImportTemplateColumns } from "@entities/listing/lib/listing-import-mapping";
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

const csvTemplate = [
  listingImportTemplateColumns.join(","),
  [
    "crm-1001",
    "Wongamat Sea View Residence",
    "High-floor condo near the beach with winter rental appeal",
    "condo",
    "sale_or_rent",
    "pattaya",
    "available",
    "3500000",
    "THB",
    "24000",
    "45",
    "1",
    "1",
    "18",
    "Wongamat Beach, Pattaya",
    "12.9685",
    "100.8859",
    "The Riviera Wongamat",
    "completed",
    "Riviera Group",
    "pool|gym|sea view|fiber internet",
    "https://agency.co.th/photos/wongamat-1.jpg|https://agency.co.th/photos/wongamat-2.jpg",
    "2026-11-01",
    "2027-03-31",
    "6",
    "foreign quota available",
    "2200"
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
              Upload a CSV exported from an old CRM, spreadsheet, or partner system. Use it as CRM inventory, as an AI-only
              Concierge source, or both. Files are stored in object storage and processed by a BullMQ worker in the background.
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
            templateColumns={[...listingImportTemplateColumns]}
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

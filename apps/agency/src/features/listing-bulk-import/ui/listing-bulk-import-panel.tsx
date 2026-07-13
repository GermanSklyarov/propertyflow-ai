import { FileSpreadsheet, Upload } from "lucide-react";
import { importPropertiesCsvAction } from "@entities/listing/api/listing-actions";
import styles from "./listing-bulk-import-panel.module.css";

interface ListingBulkImportPanelProps {
  result?: {
    error?: "empty";
    jobId?: string;
  };
}

const templateColumns = [
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

export function ListingBulkImportPanel({ result }: ListingBulkImportPanelProps) {
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

          <form action={importPropertiesCsvAction} className={styles.form}>
            <label className={styles.fileDrop}>
              <FileSpreadsheet size={20} />
              <span>Upload CSV export</span>
              <small>Use UTF-8 CSV. Required column: title. Unknown columns are ignored.</small>
              <input accept=".csv,text/csv,text/plain" name="listingsCsv" type="file" />
            </label>

            <label className={styles.csvPaste}>
              <span>Or paste CSV rows</span>
              <textarea
                name="csvText"
                placeholder="title,market,kind,listingType,priceThb,areaSqm&#10;Wongamat Sea View,pattaya,condo,sale,3500000,45"
              />
            </label>

            <div className={styles.template}>
              {templateColumns.map((column) => (
                <code key={column}>{column}</code>
              ))}
            </div>

            <label className={styles.checkbox}>
              <input name="dryRun" type="checkbox" />
              <span>Dry-run only</span>
              <small>Validate rows and progress through the job without creating listing drafts.</small>
            </label>

            <div className={styles.actions}>
              <button type="submit">
                <Upload size={16} />
                Queue import job
              </button>
              <small>After import, agents can open drafts, attach photos, run AI description, and publish.</small>
            </div>
          </form>
        </div>
      </details>
    </section>
  );
}

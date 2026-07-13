import { FileSpreadsheet, Upload } from "lucide-react";
import { importPropertiesCsvAction } from "@entities/listing/api/listing-actions";
import styles from "./listing-bulk-import-panel.module.css";

interface ListingBulkImportPanelProps {
  result?: {
    failed: number;
    imported: number;
    limitedTo?: number;
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
              Upload a CSV exported from an old CRM, spreadsheet, or partner system. This MVP creates listing drafts now;
              production-scale imports will run as BullMQ jobs with dry-run preview, progress, and downloadable error reports.
            </p>
          </div>

          {result ? (
            <div className={result.failed > 0 ? styles.warning : styles.success} role="status">
              <strong>{result.imported} imported</strong>
              <span>{result.failed} failed or skipped</span>
              {result.limitedTo ? <small>Only the first {result.limitedTo} rows were processed in this MVP import.</small> : null}
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

            <div className={styles.actions}>
              <button type="submit">
                <Upload size={16} />
                Import listing drafts
              </button>
              <small>After import, agents can open drafts, attach photos, run AI description, and publish.</small>
            </div>
          </form>
        </div>
      </details>
    </section>
  );
}

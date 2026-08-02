"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { buildListingImportColumnMapping, parseListingImportHeaderRow } from "@entities/listing/lib/listing-import-mapping";
import styles from "./listing-bulk-import-panel.module.css";

type ImportAction = (formData: FormData) => void | Promise<void>;

interface ListingBulkImportFormProps {
  action: ImportAction;
  csvTemplateHref: string;
  templateColumns: string[];
}

export function ListingBulkImportForm({ action, csvTemplateHref, templateColumns }: ListingBulkImportFormProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const mappingJson = useMemo(() => JSON.stringify(mapping), [mapping]);

  async function updateHeadersFromFile(file: File | undefined) {
    if (!file) {
      return;
    }

    updateHeaders(await file.text());
  }

  function updateHeaders(csvText: string) {
    const nextHeaders = parseListingImportHeaderRow(csvText);
    const nextMapping = buildListingImportColumnMapping(templateColumns, nextHeaders);

    setHeaders(nextHeaders);
    setMapping(nextMapping);
  }

  function updateMapping(column: string, sourceHeader: string) {
    setMapping((current) => {
      const next = { ...current };

      if (sourceHeader) {
        next[column] = sourceHeader;
      } else {
        delete next[column];
      }

      return next;
    });
  }

  return (
    <form action={action} className={styles.form}>
      <label className={styles.fileDrop}>
        <FileSpreadsheet size={20} />
        <span>Upload CSV export</span>
        <small>Use UTF-8 CSV. We will detect headers and suggest column mapping before queueing the import.</small>
        <input
          accept=".csv,text/csv,text/plain"
          name="listingsCsv"
          onChange={(event) => void updateHeadersFromFile(event.currentTarget.files?.[0])}
          type="file"
        />
      </label>

      <label className={styles.csvPaste}>
        <span>Or paste CSV rows</span>
        <textarea
          name="csvText"
          onChange={(event) => updateHeaders(event.currentTarget.value)}
          placeholder="externalId,title,market,kind,listingType,priceThb,availableUntil,minimumRentalMonths&#10;crm-1001,Wongamat Sea View,pattaya,condo,rent,3500000,2027-03-31,12"
        />
      </label>

      <div className={styles.templatePanel}>
        <div className={styles.templateHeader}>
          <span>Accepted columns</span>
          <a download="propertyflow-listings-import-template.csv" href={csvTemplateHref}>
            <Download size={15} />
            Download CSV template
          </a>
        </div>
        <div className={styles.template}>
          {templateColumns.map((column) => (
            <code key={column}>{column}</code>
          ))}
        </div>
      </div>

      {headers.length ? (
        <div className={styles.mappingPanel}>
          <div className={styles.mappingHeader}>
            <span>Column mapping</span>
            <small>{Object.keys(mapping).length}/{templateColumns.length} matched</small>
          </div>
          <div className={styles.mappingGrid}>
            {templateColumns.map((column) => (
              <label className={styles.mappingField} key={column}>
                <span>{column}</span>
                <select onChange={(event) => updateMapping(column, event.currentTarget.value)} value={mapping[column] ?? ""}>
                  <option value="">Not mapped</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <input name="columnMapping" type="hidden" value={mappingJson} />

      <fieldset className={styles.modePanel}>
        <legend>Import mode</legend>
        <label>
          <input defaultChecked name="importMode" type="radio" value="hybrid" />
          <span>CRM + AI index</span>
          <small>Create listing drafts and make them searchable by Concierge.</small>
        </label>
        <label>
          <input name="importMode" type="radio" value="concierge_index_only" />
          <span>AI Concierge only</span>
          <small>Use this inventory for website AI search without migrating to PropertyFlow CRM yet.</small>
        </label>
        <label>
          <input name="importMode" type="radio" value="crm_inventory" />
          <span>CRM inventory only</span>
          <small>Create operational listing drafts. AI indexing can be run later.</small>
        </label>
      </fieldset>

      <label className={styles.checkbox}>
        <input name="dryRun" type="checkbox" />
        <span>Dry-run only</span>
        <small>Validate rows and mapping through the job without creating listing drafts.</small>
      </label>

      <div className={styles.actions}>
        <button type="submit">
          <Upload size={16} />
          Queue import job
        </button>
        <small>After import, agents can open drafts, attach photos, run AI description, and publish.</small>
      </div>
    </form>
  );
}

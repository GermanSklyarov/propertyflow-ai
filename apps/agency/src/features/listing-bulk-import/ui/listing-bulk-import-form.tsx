"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import styles from "./listing-bulk-import-panel.module.css";

type ImportAction = (formData: FormData) => void | Promise<void>;

interface ListingBulkImportFormProps {
  action: ImportAction;
  csvTemplateHref: string;
  templateColumns: string[];
}

const columnSynonyms: Record<string, string[]> = {
  externalId: ["externalid", "external_id", "sourceid", "source_id", "listingid", "listing_id", "reference", "ref", "crm_id"],
  title: ["title", "name", "property_name", "listing_title", "project", "project_name"],
  market: ["market", "city", "area", "location", "province", "destination"],
  kind: ["kind", "type", "property_type", "asset_type", "category"],
  listingType: ["listingtype", "listing_type", "intent", "transaction", "deal_type", "offer_type"],
  priceThb: ["pricethb", "price_thb", "price", "sale_price", "asking_price", "purchase_price"],
  rentalPriceMonthlyThb: ["rentalpricemonthlythb", "rental_price_monthly_thb", "monthly_rent", "rent", "rental_price"],
  areaSqm: ["areasqm", "area_sqm", "area", "sqm", "size", "size_sqm"],
  bedrooms: ["bedrooms", "beds", "bed"],
  bathrooms: ["bathrooms", "baths", "bath"],
  address: ["address", "location_address", "street", "landmark"],
  amenities: ["amenities", "features", "facilities", "tags"],
  description: ["description", "details", "notes", "agent_note", "remark"]
};

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
    const nextHeaders = parseCsvFirstRow(csvText);
    const nextMapping = automapColumns(templateColumns, nextHeaders);

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
          placeholder="externalId,title,market,kind,listingType,priceThb,areaSqm&#10;crm-1001,Wongamat Sea View,pattaya,condo,sale,3500000,45"
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

function automapColumns(columns: string[], headers: string[]) {
  const normalizedHeaderByHeader = new Map(headers.map((header) => [normalizeHeader(header), header]));

  return Object.fromEntries(
    columns
      .map((column) => {
        const match = columnSynonyms[column]?.find((candidate) => normalizedHeaderByHeader.has(candidate));

        return match ? [column, normalizedHeaderByHeader.get(match)!] : undefined;
      })
      .filter((entry): entry is [string, string] => Boolean(entry))
  );
}

function parseCsvFirstRow(csv: string) {
  const row: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const nextChar = csv[index + 1];

    if (char === '"' && inQuotes && nextChar === '"') {
      currentCell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(currentCell.trim());
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      row.push(currentCell.trim());
      return row.filter(Boolean);
    }

    currentCell += char;
  }

  row.push(currentCell.trim());

  return row.filter(Boolean);
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

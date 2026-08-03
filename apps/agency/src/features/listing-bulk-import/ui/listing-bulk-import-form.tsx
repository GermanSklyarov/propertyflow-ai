"use client";

import { useMemo, useState } from "react";
import { Download, FileSpreadsheet, Info, Upload } from "lucide-react";
import {
  buildListingImportColumnMapping,
  getListingImportColumnImportance,
  getListingImportColumnLabel,
  parseListingImportHeaderRow,
  type ListingImportColumnImportance
} from "@entities/listing/lib/listing-import-mapping";
import type { ListingSourceImportMode } from "@propertyflow/contracts";
import { FileDropField } from "@shared/ui/file-drop-field";
import styles from "./listing-bulk-import-panel.module.css";

type ImportAction = (formData: FormData) => void | Promise<void>;

interface ListingBulkImportFormProps {
  action: ImportAction;
  csvTemplateHref: string;
  importMode?: ListingSourceImportMode;
  returnTo?: "/knowledge" | "/listings";
  templateColumns: string[];
  variant?: "crm" | "starter";
}

const importanceClassByValue: Record<ListingImportColumnImportance, string> = {
  optional: styles.mappingImportanceOptional,
  recommended: styles.mappingImportanceRecommended,
  required: styles.mappingImportanceRequired
};

const modeNoticeByVariant = {
  crm: {
    title: "CRM import",
    description:
      "Rows become listing drafts and can also be indexed for Concierge when AI indexing is enabled for this import."
  },
  starter: {
    title: "Starter import",
    description:
      "Listings become searchable by the AI Concierge without forcing the agency to migrate into PropertyFlow CRM."
  }
} as const;

export function ListingBulkImportForm({
  action,
  csvTemplateHref,
  importMode = "hybrid",
  returnTo = "/listings",
  templateColumns,
  variant = "crm"
}: ListingBulkImportFormProps) {
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const mappingJson = useMemo(() => JSON.stringify(mapping), [mapping]);
  const modeNotice = modeNoticeByVariant[variant];
  const requiredColumns = useMemo(
    () => templateColumns.filter((column) => getListingImportColumnImportance(column) === "required"),
    [templateColumns]
  );
  const recommendedColumns = useMemo(
    () => templateColumns.filter((column) => getListingImportColumnImportance(column) === "recommended"),
    [templateColumns]
  );
  const missingRequiredCount = requiredColumns.filter((column) => !mapping[column]).length;
  const matchedRecommendedCount = recommendedColumns.filter((column) => mapping[column]).length;
  const hasBlockingMapping = headers.length > 0 && missingRequiredCount > 0;

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

  function getMappingHint(column: string, mappedHeader?: string) {
    const importance = getListingImportColumnImportance(column);

    if (mappedHeader) {
      return `Mapped from "${mappedHeader}".`;
    }

    if (importance === "required") {
      return "Required. Choose the matching column before queueing the import.";
    }

    if (importance === "recommended") {
      return "Recommended for stronger Concierge answers. Leave unmapped if your export has no such field.";
    }

    return "Optional. Safe to skip if your agency does not track this data.";
  }

  return (
    <form action={action} className={styles.form}>
      <FileDropField
        accept=".csv,text/csv,text/plain"
        className={styles.importDrop}
        description="Drop a UTF-8 CSV export here. We will detect headers and suggest column mapping before queueing the import."
        icon={<FileSpreadsheet size={22} />}
        name="listingsCsv"
        onFilesSelected={(files) => void updateHeadersFromFile(files[0])}
        title="Upload CSV export"
        variant="compact"
      />

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
            <div>
              <span>Column mapping</span>
              <p>
                Required fields must be mapped. Recommended fields improve Concierge answers. Optional fields can stay
                skipped when they do not exist in the agency export.
              </p>
            </div>
            <small>
              {Object.keys(mapping).length}/{templateColumns.length} matched · {matchedRecommendedCount}/
              {recommendedColumns.length} recommended
            </small>
          </div>
          <div className={styles.mappingLegend}>
            <span className={styles.mappingImportanceRequired}>Required</span>
            <span className={styles.mappingImportanceRecommended}>Recommended</span>
            <span className={styles.mappingImportanceOptional}>Optional</span>
          </div>
          <div className={styles.mappingGrid}>
            {templateColumns.map((column) => {
              const importance = getListingImportColumnImportance(column);
              const mappedHeader = mapping[column];

              return (
                <label className={styles.mappingField} key={column}>
                  <span className={styles.mappingFieldTop}>
                    <span>{getListingImportColumnLabel(column)}</span>
                    <small className={importanceClassByValue[importance]}>{importance}</small>
                  </span>
                  <select onChange={(event) => updateMapping(column, event.currentTarget.value)} value={mappedHeader ?? ""}>
                    <option value="">Skip / not in my export</option>
                    {headers.map((header) => (
                      <option key={header} value={header}>
                        {header}
                      </option>
                    ))}
                  </select>
                  <small className={styles.mappingHint}>{getMappingHint(column, mappedHeader)}</small>
                </label>
              );
            })}
          </div>
        </div>
      ) : null}

      <input name="columnMapping" type="hidden" value={mappingJson} />
      <input name="importMode" type="hidden" value={importMode} />
      <input name="returnTo" type="hidden" value={returnTo} />

      <div className={styles.starterModeNotice}>
        <Info size={17} />
        <div>
          <strong>{modeNotice.title}</strong>
          <span>{modeNotice.description}</span>
        </div>
      </div>

      <label className={styles.checkbox}>
        <input name="dryRun" type="checkbox" />
        <span>Dry-run only</span>
        <small>Validate rows and mapping through the job without creating listing drafts.</small>
      </label>

      <div className={styles.actions}>
        <button disabled={hasBlockingMapping} type="submit">
          <Upload size={16} />
          Queue import job
        </button>
        <small>
          {hasBlockingMapping
            ? "Map the required title column before queueing the import."
            : "After import, Concierge can use listing data together with documents and website knowledge."}
        </small>
      </div>
    </form>
  );
}

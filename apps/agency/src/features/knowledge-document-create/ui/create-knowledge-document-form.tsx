import { DatabaseZap, FileText } from "lucide-react";
import { createKnowledgeDocumentAction } from "@entities/knowledge/api/knowledge-actions";
import { knowledgeKindOptions, knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import { knowledgeDocumentSourcePresets } from "@entities/knowledge/model/knowledge-source-presets";
import { formatBucket } from "@shared/lib/formatters";
import { FileDropField } from "@shared/ui/file-drop-field";
import styles from "./create-knowledge-document-form.module.css";

export function CreateKnowledgeDocumentForm() {
  return (
    <form action={createKnowledgeDocumentAction} className={styles.form}>
      <label className={`${styles.wide} ${styles.sourceType}`}>
        Source type
        <select defaultValue="faq" name="sourcePreset">
          {knowledgeDocumentSourcePresets.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.title} · {formatBucket(preset.defaultKind)}
            </option>
          ))}
        </select>
        <small>PropertyFlow uses this to add source tags and route the document into the starter checklist.</small>
      </label>
      <label className={styles.wide}>
        Title
        <input name="title" placeholder="Buying guide, visa FAQ, company information, condo brochure..." required />
      </label>
      <label>
        Locale
        <select defaultValue="en" name="locale">
          {knowledgeLocaleOptions.map((locale) => (
            <option key={locale} value={locale}>
              {locale.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
      <label>
        Kind fallback
        <select defaultValue="faq" name="kind">
          {knowledgeKindOptions.map((kind) => (
            <option key={kind} value={kind}>
              {formatBucket(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.wide}>
        Extra tags
        <input name="tags" placeholder="pattaya, wongamat, transfer-fee, developer-name" />
      </label>
      <label className={`${styles.wide} ${styles.sourceUrl}`}>
        Source URL
        <input name="sourceUrl" placeholder="https://agency.example.com/faq/buying-property-in-thailand" type="url" />
        <small>Optional, but useful for website pages, blog articles, public PDFs, and future re-sync checks.</small>
      </label>
      <label className={styles.wide}>
        Body
        <textarea
          name="body"
          placeholder="Paste source material or a cleaned transcript. You can also drop a text, markdown, CSV, JSON, HTML, or XML file below."
          rows={8}
        />
      </label>
      <div className={styles.wide}>
        <FileDropField
          accept=".txt,.md,.csv,.json,.html,.xml,.pdf,.png,.jpg,.jpeg,text/*,application/json,application/xml,application/pdf,image/*"
          description="Text-like files are read immediately. PDFs and images are stored as source files for the upcoming OCR/PDF worker."
          icon={<FileText size={24} />}
          name="sourceFile"
          title="Drop knowledge file"
          variant="compact"
        />
      </div>
      <button type="submit">
        <DatabaseZap size={16} />
        Create and ingest
      </button>
    </form>
  );
}

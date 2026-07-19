import { DatabaseZap, FileText } from "lucide-react";
import { createKnowledgeDocumentAction } from "@entities/knowledge/api/knowledge-actions";
import { knowledgeKindOptions, knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import { formatBucket } from "@shared/lib/formatters";
import { FileDropField } from "@shared/ui/file-drop-field";
import styles from "./create-knowledge-document-form.module.css";

export function CreateKnowledgeDocumentForm() {
  return (
    <form action={createKnowledgeDocumentAction} className={styles.form}>
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
        Kind
        <select defaultValue="faq" name="kind">
          {knowledgeKindOptions.map((kind) => (
            <option key={kind} value={kind}>
              {formatBucket(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.wide}>
        Tags
        <input name="tags" placeholder="faq, buying, visa, tax, pattaya, developer" />
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
          accept=".txt,.md,.csv,.json,.html,.xml,text/*,application/json,application/xml"
          description="Text-like files are read immediately and queued for knowledge ingestion. PDF/OCR ingestion is the next backend worker step."
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

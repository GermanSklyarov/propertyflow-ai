import { DatabaseZap } from "lucide-react";
import { createKnowledgeDocumentAction } from "@entities/knowledge/api/knowledge-actions";
import { knowledgeKindOptions, knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import { formatBucket } from "@shared/lib/formatters";
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
          placeholder="Paste source material or a cleaned transcript. File upload will come next; for now this text is queued for ingestion immediately."
          required
          rows={8}
        />
      </label>
      <button type="submit">
        <DatabaseZap size={16} />
        Create and ingest
      </button>
    </form>
  );
}

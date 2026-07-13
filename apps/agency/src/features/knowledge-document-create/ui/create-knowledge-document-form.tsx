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
        <input name="title" placeholder="Wongamat family relocation guide" required />
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
        <select defaultValue="relocation" name="kind">
          {knowledgeKindOptions.map((kind) => (
            <option key={kind} value={kind}>
              {formatBucket(kind)}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.wide}>
        Tags
        <input name="tags" placeholder="pattaya, wongamat, family" />
      </label>
      <label className={styles.wide}>
        Body
        <textarea name="body" placeholder="Add the source material agents would normally explain by hand..." required rows={8} />
      </label>
      <button type="submit">
        <DatabaseZap size={16} />
        Create and ingest
      </button>
    </form>
  );
}

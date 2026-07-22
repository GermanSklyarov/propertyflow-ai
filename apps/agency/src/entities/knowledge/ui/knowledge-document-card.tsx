import { RefreshCcw } from "lucide-react";
import { ingestKnowledgeDocumentAction } from "@entities/knowledge/api/knowledge-actions";
import { excerpt } from "@entities/knowledge/lib/knowledge-text";
import { assessKnowledgeDocumentReadiness } from "@entities/knowledge/model/knowledge-document-readiness";
import type { KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { formatBucket, formatDate } from "@shared/lib/formatters";
import styles from "./knowledge-document-card.module.css";

export function KnowledgeDocumentCard({ document }: { document: KnowledgeDocumentSnapshot }) {
  const readiness = assessKnowledgeDocumentReadiness(document);

  return (
    <article className={styles.card}>
      <div className={styles.main}>
        <div className={styles.top}>
          <span>{document.locale.toUpperCase()}</span>
          <span>{formatBucket(document.kind)}</span>
          <span className={styles[readiness.status]}>{readiness.label}</span>
        </div>
        <h3>{document.title}</h3>
        <p>{excerpt(document.body)}</p>
        <div className={styles.readinessNote}>
          <strong>{readiness.score}/3 retrieval signals</strong>
          <span>{readiness.summary}</span>
          {readiness.missingSignals.length ? <small>Missing: {readiness.missingSignals.join(", ")}</small> : null}
        </div>
        <div className={styles.tagRow}>
          {document.tags.length ? document.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>untagged</span>}
        </div>
      </div>
      <div className={styles.meta}>
        <span>Updated {formatDate(document.updatedAt)}</span>
        <form action={ingestKnowledgeDocumentAction.bind(null, document.id, document.title)}>
          <button type="submit">
            <RefreshCcw size={15} />
            Re-ingest
          </button>
        </form>
      </div>
    </article>
  );
}

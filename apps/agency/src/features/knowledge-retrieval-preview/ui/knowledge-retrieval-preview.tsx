import { CircleAlert, CircleCheck, DatabaseZap, Search, SearchCheck } from "lucide-react";
import { embedKnowledgeChunksAction } from "@entities/knowledge/api/knowledge-actions";
import { excerpt } from "@entities/knowledge/lib/knowledge-text";
import { knowledgeKindOptions, knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import type {
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeEmbeddingHealthSnapshot
} from "@propertyflow/contracts";
import { formatBucket, formatDate, formatNumber } from "@shared/lib/formatters";
import styles from "./knowledge-retrieval-preview.module.css";

export function KnowledgeRetrievalPreview({
  embeddingHealth,
  retrieval,
  retrievalRequest
}: {
  embeddingHealth: KnowledgeEmbeddingHealthSnapshot;
  retrieval: KnowledgeChunkSearchResponse;
  retrievalRequest: KnowledgeChunkSearchRequest;
}) {
  const HealthIcon = embeddingHealth.ready ? CircleCheck : CircleAlert;

  return (
    <>
      <form className={styles.form}>
        <label className={styles.query}>
          Query
          <input defaultValue={retrievalRequest.query} name="q" placeholder="quiet family area near beach" />
        </label>
        <label>
          Locale
          <select defaultValue={retrievalRequest.locale ?? ""} name="locale">
            <option value="">Any</option>
            {knowledgeLocaleOptions.map((locale) => (
              <option key={locale} value={locale}>
                {locale.toUpperCase()}
              </option>
            ))}
          </select>
        </label>
        <label>
          Kind
          <select defaultValue={retrievalRequest.kind ?? ""} name="kind">
            <option value="">Any</option>
            {knowledgeKindOptions.map((kind) => (
              <option key={kind} value={kind}>
                {formatBucket(kind)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">
          <Search size={16} />
          Test retrieval
        </button>
      </form>
      <section className={styles.healthPanel} data-ready={embeddingHealth.ready} aria-label="Knowledge embedding health">
        <div className={styles.healthSummary}>
          <HealthIcon size={18} />
          <div>
            <strong>{embeddingHealth.ready ? "Vectors current" : "Vectors need attention"}</strong>
            <span>
              {formatBucket(embeddingHealth.targetProvider)} · {embeddingHealth.targetModel} ·{" "}
              {embeddingHealth.targetDimensions} dimensions
            </span>
          </div>
        </div>
        <div className={styles.healthStats}>
          <HealthStat label="current" value={embeddingHealth.currentChunks} />
          <HealthStat label="stale" value={embeddingHealth.staleChunks} />
          <HealthStat label="pending" value={embeddingHealth.pendingChunks} />
          <HealthStat label="failed" value={embeddingHealth.failedChunks} />
        </div>
      </section>
      <form action={embedKnowledgeChunksAction} className={styles.embedForm}>
        <input name="q" type="hidden" value={retrievalRequest.query} />
        <input name="locale" type="hidden" value={retrievalRequest.locale ?? ""} />
        <input name="kind" type="hidden" value={retrievalRequest.kind ?? ""} />
        <span>Refresh search vectors with the active embedding provider, including stale chunks from older models.</span>
        <button type="submit">
          <DatabaseZap size={16} />
          Refresh vectors
        </button>
      </form>

      {retrieval.items.length ? (
        <div className={styles.chunkList}>
          {retrieval.items.map((chunk) => (
            <article className={styles.chunkCard} key={chunk.id}>
              <div className={styles.chunkTop}>
                <div>
                  <span>{chunk.locale.toUpperCase()}</span>
                  <span>{formatBucket(chunk.kind)}</span>
                  <span>{formatBucket(chunk.embeddingStatus)}</span>
                </div>
                <strong>{formatNumber(chunk.score)} score</strong>
              </div>
              <h3>{chunk.title}</h3>
              <p>{excerpt(chunk.content, 240)}</p>
              <div className={styles.chunkMeta}>
                <span>{chunk.tokenEstimate} tokens</span>
                <span>Chunk {chunk.chunkIndex + 1}</span>
                <span>Updated {formatDate(chunk.updatedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <SearchCheck size={24} />
          <strong>No matching chunks</strong>
          <p>Try a broader query or ingest more documents before testing AI retrieval.</p>
        </div>
      )}
    </>
  );
}

function HealthStat({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <strong>{formatNumber(value)}</strong>
      <em>{label}</em>
    </span>
  );
}

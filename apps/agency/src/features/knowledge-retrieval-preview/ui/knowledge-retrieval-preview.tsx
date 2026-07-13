import { DatabaseZap, Search, SearchCheck } from "lucide-react";
import { embedKnowledgeChunksAction } from "@entities/knowledge/api/knowledge-actions";
import { excerpt } from "@entities/knowledge/lib/knowledge-text";
import { knowledgeKindOptions, knowledgeLocaleOptions } from "@entities/knowledge/model/knowledge-options";
import type { KnowledgeChunkSearchRequest, KnowledgeChunkSearchResponse } from "@propertyflow/contracts";
import { formatBucket, formatDate, formatNumber } from "@shared/lib/formatters";
import styles from "./knowledge-retrieval-preview.module.css";

export function KnowledgeRetrievalPreview({
  retrieval,
  retrievalRequest
}: {
  retrieval: KnowledgeChunkSearchResponse;
  retrievalRequest: KnowledgeChunkSearchRequest;
}) {
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
      <form action={embedKnowledgeChunksAction} className={styles.embedForm}>
        <input name="q" type="hidden" value={retrievalRequest.query} />
        <input name="locale" type="hidden" value={retrievalRequest.locale ?? ""} />
        <input name="kind" type="hidden" value={retrievalRequest.kind ?? ""} />
        <span>Queue local-hash embeddings for pending chunks, then retest retrieval quality.</span>
        <button type="submit">
          <DatabaseZap size={16} />
          Queue embeddings
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

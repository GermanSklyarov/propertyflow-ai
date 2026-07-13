import type { ReactNode } from "react";
import { Bot, BookOpenText, DatabaseZap, FileText, Languages, Plus, RefreshCcw, Search, SearchCheck, Tags } from "lucide-react";
import {
  createKnowledgeDocumentAction,
  embedKnowledgeChunksAction,
  ingestKnowledgeDocumentAction
} from "@entities/knowledge/api/knowledge-actions";
import type {
  AiChatRequest,
  AiChatResponse,
  BackgroundJobMonitorItem,
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeDocumentKind,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";
import { formatBucket, formatDate, formatNumber } from "@shared/lib/formatters";
import styles from "./knowledge-base-page.module.css";

const localeOptions: KnowledgeDocumentSnapshot["locale"][] = ["en", "ru", "th", "zh"];
const kindOptions: KnowledgeDocumentKind[] = ["article", "neighborhood", "relocation", "legal", "investment", "faq"];

export function KnowledgeBasePage({
  chat,
  chatRequest,
  documents,
  jobs,
  notice,
  retrieval,
  retrievalRequest,
  total
}: {
  chat?: AiChatResponse;
  chatRequest?: AiChatRequest;
  documents: KnowledgeDocumentSnapshot[];
  jobs: BackgroundJobMonitorItem[];
  notice?: { message: string; tone: "success" };
  retrieval: KnowledgeChunkSearchResponse;
  retrievalRequest: KnowledgeChunkSearchRequest;
  total: number;
}) {
  const kindCount = new Set(documents.map((document) => document.kind)).size;
  const localeCount = new Set(documents.map((document) => document.locale)).size;
  const taggedCount = documents.filter((document) => document.tags.length > 0).length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">RAG operations</p>
            <h1 className={styles.title}>Knowledge base</h1>
            <p className={styles.subtitle}>
              Maintain the agency content that AI Concierge, listing chat, relocation advice, and investment answers can retrieve.
            </p>
          </div>
          <span className={styles.statusBadge}>Tenant-scoped</span>
        </header>

        {notice ? (
          <section className={styles.notice} aria-live="polite">
            <DatabaseZap size={18} />
            <strong>{notice.message}</strong>
          </section>
        ) : null}

        <section className={styles.kpiGrid} aria-label="Knowledge base overview">
          <KpiCard icon={<BookOpenText size={18} />} label="Documents" note="Tenant knowledge" value={total} />
          <KpiCard icon={<FileText size={18} />} label="Content kinds" note="RAG routing" value={kindCount} />
          <KpiCard icon={<Languages size={18} />} label="Locales" note="Multilingual advice" value={localeCount} />
          <KpiCard icon={<Tags size={18} />} label="Tagged docs" note="Retrieval hints" value={taggedCount} />
        </section>

        <section className={styles.panel} id="retrieval-preview">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Retrieval preview</p>
              <h2 className={styles.panelTitle}>Test what AI can retrieve</h2>
            </div>
            <span className={styles.statusBadge}>{formatBucket(retrieval.retrieval)}</span>
          </div>

          <form className={styles.retrievalForm}>
            <label className={styles.retrievalQuery}>
              Query
              <input defaultValue={retrievalRequest.query} name="q" placeholder="quiet family area near beach" />
            </label>
            <label>
              Locale
              <select defaultValue={retrievalRequest.locale ?? ""} name="locale">
                <option value="">Any</option>
                {localeOptions.map((locale) => (
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
                {kindOptions.map((kind) => (
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
        </section>

        <section className={styles.panel} id="knowledge-chat">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">AI answer check</p>
              <h2 className={styles.panelTitle}>Ask AI from knowledge</h2>
            </div>
            <Bot size={20} />
          </div>

          <form className={styles.chatForm}>
            <label className={styles.chatQuery}>
              Question
              <input
                defaultValue={chatRequest?.message ?? "Which Pattaya area is best for a quiet family relocation?"}
                name="ask"
                placeholder="Which area is best for family relocation?"
              />
            </label>
            <label>
              Locale
              <select defaultValue={chatRequest?.locale ?? retrievalRequest.locale ?? "en"} name="locale">
                {localeOptions.map((locale) => (
                  <option key={locale} value={locale}>
                    {locale.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit">
              <Bot size={16} />
              Ask AI
            </button>
          </form>

          {chat ? (
            <article className={styles.chatAnswer}>
              <div className={styles.chatAnswerHeader}>
                <span>{chat.citations.length} citations</span>
                <span>{chat.suggestedActions.length} actions</span>
              </div>
              <h3>{chat.message}</h3>
              <p>{chat.answer}</p>
              <div className={styles.citationList}>
                {chat.citations.map((citation) => (
                  <span key={`${citation.source}-${citation.documentId ?? citation.propertyId ?? citation.label}`}>
                    {formatBucket(citation.source)} · {citation.label}
                  </span>
                ))}
              </div>
              <div className={styles.actionRow}>
                {chat.suggestedActions.map((action) => (
                  <span key={action}>{formatBucket(action)}</span>
                ))}
              </div>
            </article>
          ) : (
            <div className={styles.chatPlaceholder}>
              <Bot size={22} />
              <strong>Ask a question to verify the final AI answer</strong>
              <p>The answer will include citations, matched properties when relevant, and suggested next actions.</p>
            </div>
          )}
        </section>

        <section className={styles.panel} id="knowledge-jobs">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Worker monitor</p>
              <h2 className={styles.panelTitle}>Knowledge jobs</h2>
            </div>
            <span className={styles.statusBadge}>{jobs.length} recent</span>
          </div>

          {jobs.length ? (
            <div className={styles.jobList}>
              {jobs.map((job) => (
                <JobCard job={job} key={job.id} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <DatabaseZap size={24} />
              <strong>No knowledge jobs yet</strong>
              <p>Create a document, re-ingest a source, or queue embeddings to see worker activity here.</p>
            </div>
          )}
        </section>

        <section className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Add source</p>
                <h2 className={styles.panelTitle}>Create knowledge document</h2>
              </div>
              <Plus size={20} />
            </div>

            <form action={createKnowledgeDocumentAction} className={styles.documentForm}>
              <label className={styles.fieldWide}>
                Title
                <input name="title" placeholder="Wongamat family relocation guide" required />
              </label>
              <label>
                Locale
                <select defaultValue="en" name="locale">
                  {localeOptions.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Kind
                <select defaultValue="relocation" name="kind">
                  {kindOptions.map((kind) => (
                    <option key={kind} value={kind}>
                      {formatBucket(kind)}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.fieldWide}>
                Tags
                <input name="tags" placeholder="pattaya, wongamat, family" />
              </label>
              <label className={styles.fieldWide}>
                Body
                <textarea
                  name="body"
                  placeholder="Add the source material agents would normally explain by hand..."
                  required
                  rows={8}
                />
              </label>
              <button type="submit">
                <DatabaseZap size={16} />
                Create and ingest
              </button>
            </form>
          </section>

          <aside className={styles.sidePanel}>
            <p className="section-kicker">Retrieval posture</p>
            <h2 className={styles.sideTitle}>How this powers AI</h2>
            <div className={styles.signalList}>
              <Signal icon={<SearchCheck size={17} />} label="Concierge answers" copy="Use local market notes when explaining areas." />
              <Signal icon={<BookOpenText size={17} />} label="Listing chat" copy="Ground answers in tenant-approved source material." />
              <Signal icon={<DatabaseZap size={17} />} label="Ingestion jobs" copy="Each create or manual refresh queues background processing." />
            </div>
          </aside>
        </section>

        <section className={styles.panel} id="knowledge-list">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Indexed sources</p>
              <h2 className={styles.panelTitle}>Agency documents</h2>
            </div>
            <span className={styles.statusBadge}>{documents.length} loaded</span>
          </div>

          {documents.length ? (
            <div className={styles.documentList}>
              {documents.map((document) => (
                <DocumentCard document={document} key={document.id} />
              ))}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <BookOpenText size={24} />
              <strong>No knowledge documents yet</strong>
              <p>Add relocation guides, neighborhood notes, legal FAQs, and investment assumptions to make AI answers more useful.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function KpiCard({ icon, label, note, value }: { icon: ReactNode; label: string; note: string; value: number | string }) {
  return (
    <article className={styles.kpiCard}>
      <div className={styles.kpiIcon}>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function Signal({ icon, label, copy }: { icon: ReactNode; label: string; copy: string }) {
  return (
    <div className={styles.signalItem}>
      {icon}
      <div>
        <strong>{label}</strong>
        <span>{copy}</span>
      </div>
    </div>
  );
}

function DocumentCard({ document }: { document: KnowledgeDocumentSnapshot }) {
  return (
    <article className={styles.documentCard}>
      <div className={styles.documentMain}>
        <div className={styles.documentTop}>
          <span>{document.locale.toUpperCase()}</span>
          <span>{formatBucket(document.kind)}</span>
        </div>
        <h3>{document.title}</h3>
        <p>{excerpt(document.body)}</p>
        <div className={styles.tagRow}>
          {document.tags.length ? document.tags.map((tag) => <span key={tag}>{tag}</span>) : <span>untagged</span>}
        </div>
      </div>
      <div className={styles.documentMeta}>
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

function JobCard({ job }: { job: BackgroundJobMonitorItem }) {
  return (
    <article className={styles.jobCard}>
      <div>
        <strong>{formatJobName(job.name)}</strong>
        <span>{formatJobPayload(job)}</span>
      </div>
      <span className={styles.jobState}>{formatBucket(job.state)}</span>
      <small>{formatJobTime(job)}</small>
      <small>{job.attemptsMade ? `${job.attemptsMade} attempts` : "first attempt"}</small>
    </article>
  );
}

function formatJobName(name: BackgroundJobMonitorItem["name"]) {
  return name
    .split(".")
    .map((part) => formatBucket(part))
    .join(" / ");
}

function formatJobPayload(job: BackgroundJobMonitorItem) {
  const payload = job.payload;

  if ("documentId" in payload && payload.documentId) {
    return `document ${payload.documentId.slice(0, 8)}`;
  }

  if ("provider" in payload) {
    return `${formatBucket(payload.provider)} · ${payload.model} · ${payload.dimensions} dimensions`;
  }

  return "tenant scoped job";
}

function formatJobTime(job: BackgroundJobMonitorItem) {
  const timestamp = job.finishedAt ?? job.processedAt ?? job.createdAt;

  if (!timestamp) {
    return "time pending";
  }

  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short"
  }).format(new Date(timestamp));
}

function excerpt(value: string, limit = 180) {
  return value.length > limit ? `${value.slice(0, limit - 3).trim()}...` : value;
}

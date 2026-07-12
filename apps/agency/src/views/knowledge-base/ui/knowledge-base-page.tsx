import type { ReactNode } from "react";
import { BookOpenText, DatabaseZap, FileText, Languages, Plus, RefreshCcw, SearchCheck, Tags } from "lucide-react";
import { createKnowledgeDocumentAction, ingestKnowledgeDocumentAction } from "@entities/knowledge/api/knowledge-actions";
import type { KnowledgeDocumentKind, KnowledgeDocumentSnapshot } from "@propertyflow/contracts";
import { formatBucket, formatDate } from "@shared/lib/formatters";
import styles from "./knowledge-base-page.module.css";

const localeOptions: KnowledgeDocumentSnapshot["locale"][] = ["en", "ru", "th", "zh"];
const kindOptions: KnowledgeDocumentKind[] = ["article", "neighborhood", "relocation", "legal", "investment", "faq"];

export function KnowledgeBasePage({
  documents,
  notice,
  total
}: {
  documents: KnowledgeDocumentSnapshot[];
  notice?: { message: string; tone: "success" };
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

function excerpt(value: string) {
  return value.length > 180 ? `${value.slice(0, 177).trim()}...` : value;
}

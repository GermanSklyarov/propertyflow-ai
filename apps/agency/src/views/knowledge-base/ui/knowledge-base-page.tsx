import type { ReactNode } from "react";
import { Bot, BookOpenText, DatabaseZap, FileText, Languages, Plus, SearchCheck, Tags } from "lucide-react";
import { KnowledgeDocumentCard } from "@entities/knowledge/ui/knowledge-document-card";
import { CreateKnowledgeDocumentForm } from "@features/knowledge-document-create/ui/create-knowledge-document-form";
import { KnowledgeAiAnswerPanel } from "@features/knowledge-ai-answer/ui/knowledge-ai-answer-panel";
import { KnowledgeRetrievalPreview } from "@features/knowledge-retrieval-preview/ui/knowledge-retrieval-preview";
import type {
  AiChatRequest,
  AiChatResponse,
  BackgroundJobMonitorItem,
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeDocumentSnapshot
} from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import { KnowledgeJobsPanel } from "@widgets/knowledge-jobs/ui/knowledge-jobs-panel";
import styles from "./knowledge-base-page.module.css";

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

          <KnowledgeRetrievalPreview retrieval={retrieval} retrievalRequest={retrievalRequest} />
        </section>

        <section className={styles.panel} id="knowledge-chat">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">AI answer check</p>
              <h2 className={styles.panelTitle}>Ask AI from knowledge</h2>
            </div>
            <Bot size={20} />
          </div>

          <KnowledgeAiAnswerPanel chat={chat} chatRequest={chatRequest} retrievalRequest={retrievalRequest} />
        </section>

        <section className={styles.panel} id="knowledge-jobs">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Worker monitor</p>
              <h2 className={styles.panelTitle}>Knowledge jobs</h2>
            </div>
            <span className={styles.statusBadge}>{jobs.length} recent</span>
          </div>

          <KnowledgeJobsPanel jobs={jobs} />
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

            <CreateKnowledgeDocumentForm />
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
                <KnowledgeDocumentCard document={document} key={document.id} />
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

import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  BookOpenText,
  Building2,
  CheckCircle2,
  CircleDashed,
  DatabaseZap,
  FileText,
  Globe2,
  Languages,
  Plus,
  SearchCheck,
  Tags,
  UploadCloud
} from "lucide-react";
import {
  buildRuntimeKnowledgeSourceGroups,
  knowledgeSourceGroups,
  knowledgeSourcePipeline,
  summarizeKnowledgeSourceModes,
  summarizeKnowledgeSourceReadiness,
  type KnowledgeSourceConnector,
  type KnowledgeSourceGroup
} from "@entities/knowledge/model/knowledge-sources";
import { buildKnowledgeStarterReadiness } from "@entities/knowledge/model/knowledge-starter-readiness";
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
  sourceJobs,
  total
}: {
  chat?: AiChatResponse;
  chatRequest?: AiChatRequest;
  documents: KnowledgeDocumentSnapshot[];
  jobs: BackgroundJobMonitorItem[];
  notice?: { message: string; tone: "success" };
  retrieval: KnowledgeChunkSearchResponse;
  retrievalRequest: KnowledgeChunkSearchRequest;
  sourceJobs?: BackgroundJobMonitorItem[];
  total: number;
}) {
  const kindCount = new Set(documents.map((document) => document.kind)).size;
  const localeCount = new Set(documents.map((document) => document.locale)).size;
  const taggedCount = documents.filter((document) => document.tags.length > 0).length;
  const activeKnowledgeJobs = jobs.filter((job) => job.state === "active" || job.state === "waiting" || job.state === "delayed").length;
  const starterReadiness = buildKnowledgeStarterReadiness(documents, activeKnowledgeJobs);
  const runtimeSourceGroups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
    documents,
    jobs: sourceJobs ?? jobs,
    totalDocuments: total
  });
  const sourceModeSummary = summarizeKnowledgeSourceModes(runtimeSourceGroups);
  const sourceReadiness = summarizeKnowledgeSourceReadiness(runtimeSourceGroups);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">RAG operations</p>
            <h1 className={styles.title}>Knowledge base</h1>
            <p className={styles.subtitle}>
              Start with agency documents. PropertyFlowAI indexes the knowledge first, then AI Concierge can answer from it before
              CRM is even enabled.
            </p>
          </div>
          <span className={styles.statusBadge}>AI-first setup</span>
        </header>

        {notice ? (
          <section className={styles.notice} aria-live="polite">
            <DatabaseZap size={18} />
            <strong>{notice.message}</strong>
          </section>
        ) : null}

        <section className={styles.onboardingPanel} id="starter-knowledge">
          <div className={styles.onboardingIntro}>
            <UploadCloud size={24} />
            <div>
              <p className="section-kicker">Starter onboarding</p>
              <h2>Upload documents. AI starts useful.</h2>
              <p>
                Cover the documents a client would normally ask an agent about: buying, selling, visas, taxes, company answers,
                project brochures, and internal handoff instructions.
              </p>
            </div>
          </div>

          <div className={styles.onboardingStats}>
            <strong>
              {starterReadiness.completed}/{starterReadiness.total}
            </strong>
            <span>AI-ready source types</span>
            <small>{starterReadiness.summary}</small>
          </div>

          <div className={styles.launchAction} data-phase={starterReadiness.phase}>
            <strong>{formatStarterPhase(starterReadiness.phase)}</strong>
            <span>{starterReadiness.nextAction}</span>
          </div>

          <div className={styles.requirementGrid} aria-label="Starter knowledge checklist">
            {starterReadiness.items.map((item) => {
              const Icon = item.done ? CheckCircle2 : CircleDashed;

              return (
                <span className={item.done ? styles.requirementDone : styles.requirementMissing} key={item.id}>
                  <Icon size={15} />
                  {item.title}
                  {!item.done && item.matchedDocuments ? <small>{item.matchedDocuments} in review</small> : null}
                </span>
              );
            })}
          </div>

          <a className={styles.primaryLink} href="#create-knowledge-document">
            Add knowledge source
            <ArrowRight size={16} />
          </a>
        </section>

        <section className={styles.kpiGrid} aria-label="Knowledge base overview">
          <KpiCard icon={<BookOpenText size={18} />} label="Documents" note="Tenant knowledge" value={total} />
          <KpiCard icon={<FileText size={18} />} label="Content kinds" note="RAG routing" value={kindCount} />
          <KpiCard icon={<Languages size={18} />} label="Locales" note="Multilingual advice" value={localeCount} />
          <KpiCard icon={<Tags size={18} />} label="Tagged docs" note="Retrieval hints" value={taggedCount} />
        </section>

        <section className={styles.panel} id="knowledge-sources">
          <div className={styles.panelHeader}>
            <div>
              <p className="section-kicker">Knowledge Sources</p>
              <h2 className={styles.panelTitle}>Feed AI without forcing CRM migration</h2>
            </div>
            <span className={styles.statusBadge}>{sourceModeSummary.concierge_index_only} AI-only connectors</span>
          </div>

          <div className={styles.sourceReadinessStrip} aria-label="Knowledge source readiness">
            <SourceReadinessMetric label="Connected" note="feeding AI now" value={sourceReadiness.connected} />
            <SourceReadinessMetric label="Indexing" note="worker active" value={sourceReadiness.indexing} />
            <SourceReadinessMetric label="Actionable" note="setup links ready" value={sourceReadiness.actionable} />
            <SourceReadinessMetric label="Planned" note="roadmap sources" value={sourceReadiness.planned} />
          </div>

          <div className={styles.sourcesGrid}>
            {runtimeSourceGroups.map((group) => (
              <KnowledgeSourceGroupCard group={group} key={group.type} />
            ))}
          </div>

          <div className={styles.pipelineStrip} aria-label="Unified knowledge ingestion pipeline">
            {knowledgeSourcePipeline.map((step, index) => (
              <div className={styles.pipelineStep} key={step.label}>
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.note}</small>
              </div>
            ))}
          </div>
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
          <section className={styles.panel} id="create-knowledge-document">
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

function SourceReadinessMetric({ label, note, value }: { label: string; note: string; value: number }) {
  return (
    <article className={styles.sourceReadinessMetric}>
      <strong>{value}</strong>
      <span>{label}</span>
      <small>{note}</small>
    </article>
  );
}

function formatStarterPhase(phase: ReturnType<typeof buildKnowledgeStarterReadiness>["phase"]) {
  const labels = {
    empty: "Upload first source",
    indexing: "Indexing knowledge",
    "launch-ready": "Starter ready",
    review: "Needs coverage"
  };

  return labels[phase];
}

function KnowledgeSourceGroupCard({ group }: { group: KnowledgeSourceGroup }) {
  return (
    <article className={styles.sourceCard}>
      <div className={styles.sourceCardHeader}>
        <div className={styles.sourceIcon}>{getSourceIcon(group.type)}</div>
        <div>
          <strong>{group.title}</strong>
          <span>{group.description}</span>
        </div>
      </div>

      <div className={styles.sourceConnectorList}>
        {group.connectors.map((connector) => (
          <SourceConnector connector={connector} key={`${group.type}-${connector.label}`} />
        ))}
      </div>
    </article>
  );
}

function SourceConnector({ connector }: { connector: KnowledgeSourceConnector }) {
  return (
    <div className={styles.sourceConnector}>
      <CheckCircle2 size={15} />
      <div>
        <strong>{connector.label}</strong>
        <span>{formatSourceMode(connector.mode)}</span>
        {connector.runtimeNote ? <em>{connector.runtimeNote}</em> : null}
      </div>
      <div className={styles.sourceConnectorBadges}>
        {connector.countLabel ? <small>{connector.countLabel}</small> : null}
        <small className={styles[connector.status]}>{connector.status}</small>
      </div>
      {connector.actionHref ? (
        <a className={styles.sourceConnectorAction} href={connector.actionHref}>
          {connector.actionLabel ?? "Open"}
          <ArrowRight size={14} />
        </a>
      ) : null}
    </div>
  );
}

function getSourceIcon(type: KnowledgeSourceGroup["type"]) {
  const icons = {
    document: <FileText size={18} />,
    external: <DatabaseZap size={18} />,
    property_feed: <Building2 size={18} />,
    website: <Globe2 size={18} />
  } satisfies Record<KnowledgeSourceGroup["type"], ReactNode>;

  return icons[type];
}

function formatSourceMode(value: KnowledgeSourceConnector["mode"]) {
  const labels = {
    concierge_index_only: "AI index only",
    crm_inventory: "CRM inventory",
    hybrid: "CRM + AI index"
  } satisfies Record<KnowledgeSourceConnector["mode"], string>;

  return labels[value];
}

import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  BookOpenText,
  Building2,
  CheckCircle2,
  CircleDashed,
  Clock3,
  DatabaseZap,
  FileText,
  Globe2,
  Languages,
  Plus,
  RefreshCw,
  Rocket,
  SearchCheck,
  Tags,
  UploadCloud
} from "lucide-react";
import {
  createRestListingSourceAction,
  previewRestListingSourceAction,
  syncListingSourceAction,
  updateListingSourceScheduleAction
} from "@entities/knowledge/api/knowledge-actions";
import {
  buildKnowledgeSourceCoverage,
  buildKnowledgeSourceGroupAction,
  buildKnowledgeSourceLaunchGate,
  buildRuntimeKnowledgeSourceGroups,
  filterOperationalKnowledgeSourceGroups,
  knowledgeSourceGroups,
  knowledgeSourcePipeline,
  summarizeKnowledgeSourceModes,
  summarizeKnowledgeSourceReadiness,
  type KnowledgeSourceConnector,
  type KnowledgeSourceCoverageItem,
  type KnowledgeSourceGroup
} from "@entities/knowledge/model/knowledge-sources";
import { buildKnowledgeStarterReadiness } from "@entities/knowledge/model/knowledge-starter-readiness";
import {
  LISTING_API_CUSTOM_ATTRIBUTE_RULES,
  LISTING_API_CONTRACT_SECTIONS,
  LISTING_API_EXAMPLE_PAYLOAD,
  LISTING_API_SETUP_STEPS,
  countListingApiContractFields
} from "@entities/knowledge/model/listing-api-contract";
import {
  DEFAULT_LISTING_CANONICAL_MAPPING,
  DEFAULT_LISTING_CUSTOM_ATTRIBUTES
} from "@entities/knowledge/model/listing-source-form";
import { buildListingSourceSummary } from "@entities/knowledge/model/listing-source-summary";
import { KnowledgeDocumentCard } from "@entities/knowledge/ui/knowledge-document-card";
import { CreateKnowledgeDocumentForm } from "@features/knowledge-document-create/ui/create-knowledge-document-form";
import { KnowledgeAiAnswerPanel } from "@features/knowledge-ai-answer/ui/knowledge-ai-answer-panel";
import { KnowledgeRetrievalPreview } from "@features/knowledge-retrieval-preview/ui/knowledge-retrieval-preview";
import { ListingBulkImportPanel } from "@features/listing-bulk-import/ui/listing-bulk-import-panel";
import type {
  AiChatRequest,
  AiChatResponse,
  BackgroundJobMonitorItem,
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeDocumentSnapshot,
  KnowledgeEmbeddingHealthSnapshot,
  ListingSourceSnapshot
} from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import { KnowledgeJobsPanel } from "@widgets/knowledge-jobs/ui/knowledge-jobs-panel";
import { ListingSourceSyncRefresh } from "./listing-source-sync-refresh";
import styles from "./knowledge-base-page.module.css";

export function KnowledgeBasePage({
  chat,
  chatRequest,
  createSourceOpen = false,
  documents,
  embeddingHealth,
  jobs,
  listingKnowledgeDocuments = [],
  listingKnowledgeOpen = false,
  listingKnowledgeShowMoreHref,
  listingKnowledgeTotal = 0,
  listingImportResult,
  listingSources,
  notice,
  retrieval,
  retrievalRequest,
  sourceJobs,
  total
}: {
  chat?: AiChatResponse;
  chatRequest?: AiChatRequest;
  createSourceOpen?: boolean;
  documents: KnowledgeDocumentSnapshot[];
  embeddingHealth: KnowledgeEmbeddingHealthSnapshot;
  jobs: BackgroundJobMonitorItem[];
  listingKnowledgeDocuments?: KnowledgeDocumentSnapshot[];
  listingKnowledgeOpen?: boolean;
  listingKnowledgeShowMoreHref?: string;
  listingKnowledgeTotal?: number;
  listingImportResult?: { error?: "empty"; jobId?: string };
  listingSources: ListingSourceSnapshot[];
  notice?: { message: string; tone: "success" | "warning" };
  retrieval: KnowledgeChunkSearchResponse;
  retrievalRequest: KnowledgeChunkSearchRequest;
  sourceJobs?: BackgroundJobMonitorItem[];
  total: number;
}) {
  const allKnowledgeDocuments = [...documents, ...listingKnowledgeDocuments];
  const kindCount = new Set(documents.map((document) => document.kind)).size;
  const localeCount = new Set(documents.map((document) => document.locale)).size;
  const taggedCount = documents.filter((document) => document.tags.length > 0).length;
  const activeKnowledgeJobs = jobs.filter((job) => job.state === "active" || job.state === "waiting" || job.state === "delayed").length;
  const starterReadiness = buildKnowledgeStarterReadiness(allKnowledgeDocuments, activeKnowledgeJobs);
  const runtimeSourceGroups = buildRuntimeKnowledgeSourceGroups(knowledgeSourceGroups, {
    documents: allKnowledgeDocuments,
    jobs: sourceJobs ?? jobs,
    listingSources,
    totalDocuments: total + listingKnowledgeTotal
  });
  const operationalSourceGroups = filterOperationalKnowledgeSourceGroups(runtimeSourceGroups);
  const sourceModeSummary = summarizeKnowledgeSourceModes(operationalSourceGroups);
  const sourceReadiness = summarizeKnowledgeSourceReadiness(operationalSourceGroups);
  const listingImportJobs = (sourceJobs ?? jobs).filter((job) => job.name === "properties.import");
  const hasMoreListingKnowledge = listingKnowledgeDocuments.length < listingKnowledgeTotal;
  const sourceLaunchGate = buildKnowledgeSourceLaunchGate(sourceReadiness, {
    starterLaunchReady: starterReadiness.launchReady,
    starterNextAction: starterReadiness.nextAction,
    starterSummary: starterReadiness.summary
  });
  const sourceCoverage = buildKnowledgeSourceCoverage(operationalSourceGroups);

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
          <section className={styles.notice} data-tone={notice.tone} aria-live="polite">
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

          {starterReadiness.nextActions.length ? (
            <div className={styles.nextSourceActions} aria-label="Recommended next knowledge actions">
              {starterReadiness.nextActions.map((action) => (
                <a className={styles.nextSourceAction} data-priority={action.priority} href={action.href} key={action.id}>
                  <strong>{action.label}</strong>
                  <span>{action.reason}</span>
                </a>
              ))}
            </div>
          ) : null}

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

          <a className={styles.primaryLink} href="?create=source#create-knowledge-document">
            Add knowledge source
            <ArrowRight size={16} />
          </a>
        </section>

        <section className={styles.kpiGrid} aria-label="Knowledge base overview">
          <KpiCard icon={<BookOpenText size={18} />} label="Documents" note="Agency docs" value={total} />
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
            <SourceReadinessMetric label="Failed" note="needs retry" value={sourceReadiness.failed} />
            <SourceReadinessMetric label="Actionable" note="setup links ready" value={sourceReadiness.actionable} />
          </div>

          <div className={styles.sourceLaunchGate} data-status={sourceLaunchGate.status}>
            <Rocket size={17} />
            <div>
              <strong>{sourceLaunchGate.summary}</strong>
              <span>{sourceLaunchGate.nextAction}</span>
            </div>
            <a href={sourceLaunchGate.actionHref}>{sourceLaunchGate.actionLabel}</a>
          </div>

          <div className={styles.sourceCoverageGrid} aria-label="AI source coverage">
            {sourceCoverage.map((item) => (
              <SourceCoverageCard item={item} key={item.type} />
            ))}
          </div>

          <ListingApiSourcesPanel sources={listingSources} />

          <ListingBulkImportPanel
            jobs={listingImportJobs}
            result={listingImportResult}
            returnTo="/knowledge"
            variant="starter"
          />

          <div className={styles.sourcesGrid}>
            {operationalSourceGroups.map((group) => (
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

          <KnowledgeRetrievalPreview
            embeddingHealth={embeddingHealth}
            retrieval={retrieval}
            retrievalRequest={retrievalRequest}
          />
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

        {listingKnowledgeDocuments.length ? (
          <details
            className={`${styles.panel} ${styles.listingKnowledgePanel}`}
            id="concierge-listing-imports"
            open={listingKnowledgeOpen}
          >
            <summary className={styles.listingKnowledgeSummary}>
              <div>
                <p className="section-kicker">Concierge listing imports</p>
                <h2 className={styles.panelTitle}>Listings feeding AI Concierge</h2>
              </div>
              <span className={styles.statusBadge}>
                {listingKnowledgeDocuments.length}/{listingKnowledgeTotal || listingKnowledgeDocuments.length} loaded
              </span>
            </summary>

            <div className={styles.listingKnowledgeGrid}>
              {listingKnowledgeDocuments.map((document) => (
                <ListingKnowledgeCard document={document} key={document.id} />
              ))}
            </div>

            {hasMoreListingKnowledge && listingKnowledgeShowMoreHref ? (
              <a className={styles.listingKnowledgeMore} href={listingKnowledgeShowMoreHref}>
                Show more listings
                <ArrowRight size={15} />
              </a>
            ) : null}
          </details>
        ) : null}

        <section className={styles.layout}>
          <details className={`${styles.panel} ${styles.createSourcePanel}`} id="create-knowledge-document" open={createSourceOpen}>
            <summary className={styles.createSourceSummary}>
              <div>
                <p className="section-kicker">Add source</p>
                <h2 className={styles.panelTitle}>Create knowledge source</h2>
              </div>
              <span>
                <Plus size={18} />
                <b className={styles.openFormText}>Open form</b>
                <b className={styles.closeFormText}>Close form</b>
              </span>
            </summary>

            <CreateKnowledgeDocumentForm />
          </details>

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

function ListingKnowledgeCard({ document }: { document: KnowledgeDocumentSnapshot }) {
  const summary = summarizeListingKnowledgeDocument(document);

  return (
    <article className={styles.listingKnowledgeCard}>
      <div className={styles.listingKnowledgeTop}>
        <span>{document.locale.toUpperCase()}</span>
        <span>Listing</span>
        {summary.status ? <span>{summary.status}</span> : null}
      </div>
      <h3>{document.title}</h3>
      <dl className={styles.listingKnowledgeFacts}>
        {summary.facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd>{fact.value}</dd>
          </div>
        ))}
      </dl>
      {summary.description ? <p>{summary.description}</p> : null}
      {summary.amenities.length ? (
        <div className={styles.listingKnowledgeTags}>
          {summary.amenities.map((amenity) => (
            <span key={amenity}>{amenity}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function summarizeListingKnowledgeDocument(document: KnowledgeDocumentSnapshot) {
  const fields = parseKnowledgeBodyFields(document.body);
  const facts = [
    compactFact("Market", fields.get("Market")),
    compactFact("Type", fields.get("Listing type")),
    compactFact("Price", fields.get("Price")),
    compactFact("Rent", fields.get("Monthly rent") ?? fields.get("Long-term monthly rent")),
    compactFact("Area", fields.get("Area")),
    compactFact("Bedrooms", fields.get("Bedrooms")),
    compactFact("Beach", fields.get("Beach distance")),
    compactFact("Quota", fields.get("Foreign quota"))
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));
  const amenities = splitList(fields.get("Amenities")).slice(0, 5);

  return {
    amenities,
    description: fields.get("Description"),
    facts: facts.slice(0, 8),
    status: fields.get("Status")
  };
}

function compactFact(label: string, value?: string) {
  return value ? { label, value } : undefined;
}

function parseKnowledgeBodyFields(body: string) {
  return body.split("\n").reduce((fields, line) => {
    const separatorIndex = line.indexOf(":");

    if (separatorIndex > 0) {
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();

      if (key && value && key !== "Full source payload for agency-specific constraints") {
        fields.set(key, value);
      }
    }

    return fields;
  }, new Map<string, string>());
}

function splitList(value?: string) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
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

function SourceCoverageCard({ item }: { item: KnowledgeSourceCoverageItem }) {
  return (
    <article className={styles.sourceCoverageCard} data-status={item.status}>
      <div className={styles.sourceCoverageIcon}>{getSourceIcon(item.type)}</div>
      <div>
        <strong>{item.label}</strong>
        <span>{item.description}</span>
      </div>
      <small>
        {item.failed
          ? `${item.failed} failed`
          : item.connected
            ? `${item.connected} live`
            : item.indexing
              ? `${item.indexing} indexing`
              : item.planned
                ? `${item.planned} planned`
                : "setup"}
      </small>
      {item.action ? (
        <a href={item.action.href} title={item.action.label}>
          <ArrowRight size={14} />
        </a>
      ) : null}
    </article>
  );
}

function ListingApiSourcesPanel({ sources }: { sources: ListingSourceSnapshot[] }) {
  const activeSources = sources.filter((source) => source.status !== "disabled");
  const hasSyncingSources = activeSources.some((source) => source.status === "syncing");

  return (
    <section className={styles.listingApiSources} id="listing-api-sources" aria-label="Listing feed inventory sources">
      <ListingSourceSyncRefresh enabled={hasSyncingSources} />
      <div className={styles.listingApiSourcesHeader}>
        <div>
          <p className="section-kicker">Listing feed sync</p>
          <h3 className={styles.listingApiSourcesTitle}>Existing feeds can power Concierge before CRM migration</h3>
          <p>
            Canonical mapping keeps listing search reliable, while custom attributes preserve agency-specific availability,
            fees, restrictions, and source fields the AI should still understand.
          </p>
        </div>
        <span className={styles.statusBadge}>
          {activeSources.length} feed source{activeSources.length === 1 ? "" : "s"}
        </span>
      </div>

      {hasSyncingSources ? (
        <div className={styles.listingApiSyncNotice} aria-live="polite">
          <RefreshCw size={15} />
          <strong>Feed sync is running</strong>
          <span>This panel refreshes automatically every 2.5 seconds until the worker settles.</span>
        </div>
      ) : null}

      {activeSources.length ? (
        <div className={styles.listingApiSourceGrid}>
          {activeSources.map((source) => (
            <ListingApiSourceCard source={source} key={source.id} />
          ))}
        </div>
      ) : (
        <ListingApiEmptyState />
      )}

      <ListingApiIntegrationGuide />
      <ListingApiConnectForm defaultOpen={activeSources.length === 0} />
    </section>
  );
}

function ListingApiIntegrationGuide() {
  const fieldCount = countListingApiContractFields();

  return (
    <details className={styles.listingApiGuide}>
      <summary>
        <DatabaseZap size={16} />
        Listing feed setup contract
        <span>{fieldCount} mapped signals</span>
      </summary>

      <div className={styles.listingApiGuideBody}>
        <div className={styles.listingApiSetupFlow} aria-label="Listing feed setup steps">
          {LISTING_API_SETUP_STEPS.map((step, index) => (
            <article key={step.title}>
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.description}</p>
              </div>
            </article>
          ))}
        </div>

        {LISTING_API_CONTRACT_SECTIONS.map((section) => (
          <article key={section.title}>
            <strong>{section.title}</strong>
            <p>{section.description}</p>
            <div className={styles.listingApiFieldList}>
              {section.fields.map((field) => (
                <code key={field}>{field}</code>
              ))}
            </div>
          </article>
        ))}

        <details className={styles.listingApiCustomRules}>
          <summary>
            <span>How custom fields stay useful for AI</span>
            <strong>{LISTING_API_CUSTOM_ATTRIBUTE_RULES.length} rule groups</strong>
          </summary>
          <div>
            {LISTING_API_CUSTOM_ATTRIBUTE_RULES.map((rule) => (
              <article key={rule.title}>
                <strong>{rule.title}</strong>
                <p>{rule.description}</p>
                <code>{rule.example}</code>
              </article>
            ))}
          </div>
        </details>

        <div className={styles.listingApiExample}>
          <span>Expected payload shape</span>
          <code>{LISTING_API_EXAMPLE_PAYLOAD}</code>
        </div>
      </div>
    </details>
  );
}

function ListingApiEmptyState() {
  return (
    <div className={styles.listingApiEmpty}>
      <DatabaseZap size={18} />
      <div>
        <strong>No listing feed connected yet</strong>
        <span>Connect an agency JSON or XML feed, map fields once, and let Concierge search it without forcing CRM migration.</span>
      </div>
      <ol className={styles.listingApiSetupSteps}>
        <li>
          <strong>Expose endpoint</strong>
          <span>Use a JSON or XML endpoint that returns listings as an array or under a root path like data.items or listings.listing.</span>
        </li>
        <li>
          <strong>Choose auth</strong>
          <span>Use bearer auth or an API-key header. Store the real secret as a backend secret reference.</span>
        </li>
        <li>
          <strong>Map core fields</strong>
          <span>Map title, market, price, type, images, project, available dates, and minimum rental term.</span>
        </li>
        <li>
          <strong>Preserve extras</strong>
          <span>Add custom attributes for agency-specific rules, fees, restrictions, views, and availability hints.</span>
        </li>
      </ol>
    </div>
  );
}

function ListingApiConnectForm({ defaultOpen }: { defaultOpen: boolean }) {
  return (
    <details className={styles.listingApiConnect} open={defaultOpen}>
      <summary>
        <Plus size={16} />
        {defaultOpen ? "Connect listing feed" : "Add another listing feed"}
      </summary>

      <form action={createRestListingSourceAction} className={styles.listingApiConnectForm}>
        <div className={styles.listingApiFormGrid}>
          <label>
            Feed type
            <select name="type" defaultValue="rest-api">
              <option value="rest-api">REST JSON feed</option>
              <option value="xml-feed">XML feed</option>
            </select>
          </label>
          <label>
            Source name
            <input name="name" placeholder="Agency website listing feed" required />
          </label>
          <label>
            Endpoint URL
            <input name="endpointUrl" placeholder="https://agency.co.th/api/listings or https://agency.co.th/feed.xml" required type="url" />
          </label>
          <input name="importMode" type="hidden" value="concierge_index_only" />
          <div className={styles.listingApiStarterMode}>
            <strong>Starter Concierge index</strong>
            <span>Feed data stays a searchable AI source first. CRM drafts can be enabled later on Growth.</span>
          </div>
          <label>
            Auth type
            <select name="authType" defaultValue="api-key-header">
              <option value="api-key-header">API-key header</option>
              <option value="bearer">Bearer token</option>
              <option value="none">No auth</option>
            </select>
          </label>
          <label>
            Auth header
            <input name="authHeaderName" defaultValue="x-api-key" placeholder="x-api-key" />
          </label>
          <label>
            Secret reference
            <input name="authSecretRef" placeholder="secret://demo-agency/listings-api-key" />
          </label>
          <label>
            Root path
            <input name="rootPath" placeholder="data.items or listings.listing" />
          </label>
          <label>
            Auto-update
            <select name="syncInterval" defaultValue="every_6_hours">
              <option value="disabled">Manual only</option>
              <option value="hourly">Every hour</option>
              <option value="every_6_hours">Every 6 hours</option>
              <option value="daily">Daily</option>
            </select>
          </label>
        </div>

        <div className={styles.listingApiMappingGrid}>
          <label>
            Canonical mapping
            <textarea
              name="canonicalMapping"
              defaultValue={DEFAULT_LISTING_CANONICAL_MAPPING}
              rows={13}
              spellCheck={false}
            />
          </label>
          <label>
            Custom searchable attributes
            <textarea
              name="customAttributes"
              defaultValue={DEFAULT_LISTING_CUSTOM_ATTRIBUTES}
              rows={13}
              spellCheck={false}
            />
          </label>
        </div>

        <div className={styles.listingApiSetupNote}>
          <DatabaseZap size={17} />
          <span>
            The first sync stores mapped data for Concierge retrieval. Custom attributes keep local fields queryable without
            pretending they are universal CRM columns. XML and JSON feeds use the same mapping contract.
          </span>
        </div>

        <div className={styles.listingApiFormActions}>
          <button className={styles.listingApiPreviewButton} formAction={previewRestListingSourceAction} type="submit">
            <SearchCheck size={16} />
            Check feed
          </button>
          <button className={styles.listingApiSaveButton} type="submit">
            <DatabaseZap size={16} />
            Save and sync feed
          </button>
        </div>
      </form>
    </details>
  );
}

function ListingApiSourceCard({ source }: { source: ListingSourceSnapshot }) {
  const summary = buildListingSourceSummary(source);
  const syncAction = syncListingSourceAction.bind(null, source.id, source.name);
  const scheduleAction = updateListingSourceScheduleAction.bind(null, source.id, source.name);

  return (
    <article className={styles.listingApiSourceCard} data-status={source.status}>
      <div className={styles.listingApiSourceHeader}>
        <div>
          <h4 className={styles.listingApiSourceTitle}>{source.name}</h4>
          <p className={styles.listingApiSourceEndpoint}>{source.endpointUrl}</p>
        </div>
        <span className={styles.listingApiStatus} data-tone={summary.statusTone}>
          {summary.statusLabel}
        </span>
      </div>

      <div className={styles.listingApiSourceMetrics}>
        <span>{formatListingSourceType(source.type)}</span>
        <span>{summary.canonicalCount} mapped fields</span>
        <span>{summary.customAttributeCount} custom attrs</span>
        <span>{summary.searchableCustomAttributeCount} searchable</span>
        <span>{formatImportMode(source.importMode)}</span>
        <span>{formatListingSourceSyncInterval(source.syncInterval)}</span>
      </div>

      <div className={styles.listingApiReadiness} data-ready={summary.missingProductionFields.length === 0} data-tone={summary.statusTone}>
        <div>
          <strong>{summary.readinessLabel}</strong>
          <span>{summary.operationalMessage}</span>
        </div>
        <small>{summary.lastSyncLabel}</small>
      </div>

      <div className={styles.listingApiSignalGrid} aria-label={`${source.name} Concierge signal coverage`}>
        {summary.signalCoverage.map((signal) => (
          <div className={styles.listingApiSignalCard} data-tone={signal.tone} key={signal.id}>
            <span>{signal.label}</span>
            <strong>
              {signal.covered}/{signal.total}
            </strong>
            <small>{signal.summary}</small>
          </div>
        ))}
      </div>

      <details className={styles.listingApiFieldDetails}>
        <summary>
          <span>Mapped field details</span>
          <strong>{summary.canonicalCount + summary.customAttributeCount} signals</strong>
        </summary>
        <div className={styles.listingApiCoverageGrid}>
          <ListingApiCoverageGroup
            empty="Map title, market, prices, listing type, status, and project fields."
            items={summary.mappedCanonicalFields}
            title="Canonical search"
          />
          <ListingApiCoverageGroup
            empty="Add available_until or minimum rental term so AI avoids impossible recommendations."
            items={summary.availabilitySignals}
            title="Availability logic"
          />
          <ListingApiCoverageGroup
            empty="Preserve local agency fields as searchable custom attributes."
            items={summary.searchableCustomAttributes}
            title="Custom attributes"
          />
        </div>
      </details>

      {summary.missingProductionFields.length ? (
        <div className={styles.listingApiGaps}>
          <strong>Before production</strong>
          <span>{summary.missingProductionFields.join(", ")}</span>
        </div>
      ) : null}

      {source.lastError ? <p className={styles.listingApiError}>{source.lastError}</p> : null}

      <form action={syncAction} className={styles.listingApiSyncForm}>
        <button className={styles.listingApiSyncButton} disabled={summary.syncButtonDisabled} type="submit">
          <RefreshCw size={15} />
          {summary.syncButtonLabel}
        </button>
      </form>

      <form action={scheduleAction} className={styles.listingApiScheduleForm}>
        <label>
          Auto-update
          <select name="syncInterval" defaultValue={source.syncInterval}>
            <option value="disabled">Manual only</option>
            <option value="hourly">Every hour</option>
            <option value="every_6_hours">Every 6 hours</option>
            <option value="daily">Daily</option>
          </select>
        </label>
        <button className={styles.listingApiScheduleButton} type="submit">
          Save schedule
        </button>
        <small>
          {source.nextSyncAt ? `Next sync ${formatDateTime(source.nextSyncAt)}` : "No automatic sync is scheduled."}
        </small>
      </form>
    </article>
  );
}

function ListingApiCoverageGroup({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  const visibleItems = items.slice(0, 5);
  const overflow = Math.max(0, items.length - visibleItems.length);

  return (
    <div className={styles.listingApiCoverageGroup}>
      <strong>{title}</strong>
      {items.length ? (
        <div>
          {visibleItems.map((item) => (
            <span key={`${title}-${item}`}>{item}</span>
          ))}
          {overflow ? <span>+{overflow} more</span> : null}
        </div>
      ) : (
        <p>{empty}</p>
      )}
    </div>
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
  const action = buildKnowledgeSourceGroupAction(group);

  return (
    <article className={styles.sourceCard}>
      <div className={styles.sourceCardHeader}>
        <div className={styles.sourceCardTitleRow}>
          <div className={styles.sourceIcon}>{getSourceIcon(group.type)}</div>
          <strong>{group.title}</strong>
          {action ? (
            <a className={styles.sourceGroupAction} href={action.href}>
              {action.label}
              <ArrowRight size={14} />
            </a>
          ) : null}
        </div>
        <span>{group.description}</span>
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
  const isPlanned = connector.status === "planned";

  return (
    <div className={styles.sourceConnector} data-status={connector.status}>
      {isPlanned ? <Clock3 size={15} /> : <CheckCircle2 size={15} />}
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

function formatImportMode(value: ListingSourceSnapshot["importMode"]) {
  const labels = {
    concierge_index_only: "AI index only",
    crm_inventory: "CRM inventory",
    hybrid: "CRM + AI index"
  } satisfies Record<ListingSourceSnapshot["importMode"], string>;

  return labels[value];
}

function formatListingSourceSyncInterval(value: ListingSourceSnapshot["syncInterval"]) {
  const labels = {
    daily: "Daily auto-sync",
    disabled: "Manual sync",
    every_6_hours: "6h auto-sync",
    hourly: "Hourly auto-sync"
  } satisfies Record<ListingSourceSnapshot["syncInterval"], string>;

  return labels[value];
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function formatListingSourceType(value: ListingSourceSnapshot["type"]) {
  const labels = {
    "rest-api": "REST JSON",
    "xml-feed": "XML feed"
  } satisfies Record<ListingSourceSnapshot["type"], string>;

  return labels[value];
}

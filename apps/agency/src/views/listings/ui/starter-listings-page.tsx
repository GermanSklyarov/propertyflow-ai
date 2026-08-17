import type { ReactNode } from "react";
import { DatabaseZap, FileText, ListChecks, SearchCheck } from "lucide-react";
import { ListingBulkImportPanel } from "@features/listing-bulk-import/ui/listing-bulk-import-panel";
import { LocationEnrichmentPanel } from "@features/listing-bulk-import/ui/location-enrichment-panel";
import type {
  BackgroundJobMonitorItem,
  KnowledgeDocumentSnapshot,
  ListingSourceSnapshot,
  LocationEnrichmentStatusResponse
} from "@propertyflow/contracts";
import styles from "./listings-page.module.css";

interface StarterListingsPageProps {
  importJobs: BackgroundJobMonitorItem[];
  importResult?: {
    error?: "empty";
    jobId?: string;
  };
  listingDocuments: KnowledgeDocumentSnapshot[];
  listingSources: ListingSourceSnapshot[];
  locationEnrichmentJobs: BackgroundJobMonitorItem[];
  locationEnrichmentStatus?: LocationEnrichmentStatusResponse;
  totalListingDocuments: number;
}

export function StarterListingsPage({
  importJobs,
  importResult,
  listingDocuments,
  listingSources,
  locationEnrichmentJobs,
  locationEnrichmentStatus,
  totalListingDocuments
}: StarterListingsPageProps) {
  const activeSources = listingSources.filter((source) => source.status !== "disabled");
  const syncingSources = activeSources.filter((source) => source.status === "syncing").length;
  const failedSources = activeSources.filter((source) => source.status === "failed").length;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">AI listing inventory</p>
            <h1 className={styles.title}>Listings for Concierge</h1>
            <p className={styles.subtitle}>
              Listings available to the AI Concierge. CRM editing, project operations, and publication workflows unlock on Growth.
            </p>
          </div>
          <span className={styles.totalBadge}>{totalListingDocuments} AI listings</span>
        </header>

        <section className={styles.starterKpiGrid} aria-label="AI listing inventory readiness">
          <StarterKpi icon={<FileText size={18} />} label="AI listings" note="available to Concierge" value={totalListingDocuments} />
          <StarterKpi icon={<DatabaseZap size={18} />} label="Feed sources" note="connected or draft" value={activeSources.length} />
          <StarterKpi icon={<SearchCheck size={18} />} label="Syncing" note="worker active" value={syncingSources} />
          <StarterKpi icon={<ListChecks size={18} />} label="Needs attention" note="failed sources" value={failedSources} />
        </section>

        <ListingBulkImportPanel jobs={importJobs} result={importResult} returnTo="/listings" variant="starter" />

        <LocationEnrichmentPanel initialJobs={locationEnrichmentJobs} initialStatus={locationEnrichmentStatus} />

        <section className={styles.starterPanel}>
          <div className={styles.starterPanelHeader}>
            <div>
              <p className="section-kicker">Concierge inventory</p>
              <h2>Recently imported listings</h2>
            </div>
            <span>{listingDocuments.length} visible</span>
          </div>

          {listingDocuments.length ? (
            <div className={styles.starterListingGrid}>
              {listingDocuments.map((document) => (
                <StarterListingCard document={document} key={document.id} />
              ))}
            </div>
          ) : (
            <div className={styles.starterEmpty}>
              <strong>No AI listings yet</strong>
              <span>Import a CSV or connect a feed so Concierge can search real inventory.</span>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function StarterKpi({ icon, label, note, value }: { icon: ReactNode; label: string; note: string; value: number }) {
  return (
    <article className={styles.starterKpiCard}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  );
}

function StarterListingCard({ document }: { document: KnowledgeDocumentSnapshot }) {
  const fields = parseKnowledgeBodyFields(document.body);
  const facts = [
    compactFact("Market", fields.get("Market")),
    compactFact("Type", fields.get("Listing type")),
    compactFact("Price", fields.get("Price")),
    compactFact("Rent", fields.get("Monthly rent") ?? fields.get("Long-term monthly rent")),
    compactFact("Bedrooms", fields.get("Bedrooms"))
  ].filter((fact): fact is { label: string; value: string } => Boolean(fact));

  return (
    <article className={styles.starterListingCard}>
      <div className={styles.starterListingTopline}>
        <span>{document.locale.toUpperCase()}</span>
        <span>AI indexed</span>
      </div>
      <h3>{document.title}</h3>
      {facts.length ? (
        <dl>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {document.tags.length ? (
        <div className={styles.starterListingTags}>
          {document.tags.slice(0, 5).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function compactFact(label: string, value?: string) {
  const trimmed = value?.trim();
  return trimmed ? { label, value: trimmed } : undefined;
}

function parseKnowledgeBodyFields(body: string) {
  return body.split("\n").reduce((fields, line) => {
    const [label, ...rest] = line.split(":");
    const value = rest.join(":").trim();

    if (label && value) {
      fields.set(label.trim(), value);
    }

    return fields;
  }, new Map<string, string>());
}

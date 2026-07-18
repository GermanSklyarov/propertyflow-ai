import Link from "next/link";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Home,
  KeyRound,
  Plus,
  Search
} from "lucide-react";
import { formatListingType, formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import { createPropertyProjectAction } from "@entities/project/api/project-actions";
import { AmenitiesSuggestionField } from "@features/project-create/ui/amenities-suggestion-field";
import { ProjectNameDedupeField } from "@features/project-create/ui/project-name-dedupe-field";
import type { PropertyProjectSearchResponse, PropertySearchResponse } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import { LoadState } from "@shared/ui/load-state";
import styles from "./projects-page.module.css";

const markets = [
  { label: "Pattaya", value: "pattaya" },
  { label: "Phuket", value: "phuket" },
  { label: "Bangkok", value: "bangkok" },
  { label: "Hua Hin", value: "hua-hin" },
  { label: "Koh Samui", value: "koh-samui" }
];

export function ProjectsPage({
  missingListings,
  missingListingsError,
  projectFilters,
  projects,
  projectsError
}: {
  missingListings?: PropertySearchResponse;
  missingListingsError?: string;
  projectFilters: PropertyProjectSearchResponse["filters"];
  projects?: PropertyProjectSearchResponse;
  projectsError?: string;
}) {
  const projectItems = projects?.items ?? [];
  const projectTotal = projects?.total ?? 0;
  const filters = projects?.filters ?? projectFilters;
  const missingItems = missingListings?.items ?? [];
  const projectLinkFacets = missingListings?.facets?.projectLink;
  const linkedListings = projectLinkFacets?.linked ?? 0;
  const missingProjectListings = projectLinkFacets?.missing ?? missingListings?.total ?? 0;
  const totalListings = projectLinkFacets?.all ?? linkedListings + missingProjectListings;
  const linkedRate = totalListings > 0 ? Math.round((linkedListings / totalListings) * 100) : 0;
  const statusCounts = projects?.facets?.status ?? buildProjectStatusCounts(projectItems);
  const pageSize = filters.limit ?? (projectItems.length || 1);
  const currentPage = Math.floor((filters.offset ?? 0) / pageSize) + 1;
  const pageCount = Math.max(1, Math.ceil(projectTotal / pageSize));
  const firstVisible = projectItems.length ? (currentPage - 1) * pageSize + 1 : 0;
  const lastVisible = Math.min((currentPage - 1) * pageSize + projectItems.length, projectTotal);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Development registry</p>
            <h1>Projects workspace</h1>
            <p>
              Normalize project names, spot missing links, and keep imported listings attached to the same development record.
            </p>
          </div>
          <span className={styles.totalBadge}>{projectsError ? "Unavailable" : `${projectTotal} projects`}</span>
        </header>

        <section className={styles.kpiGrid} aria-label="Project registry health">
          <MetricCard icon={<Building2 size={18} />} label="Known projects" value={projectTotal} />
          <MetricCard icon={<Home size={18} />} label="Linked listings" value={linkedListings} />
          <MetricCard icon={<AlertTriangle size={18} />} label="Missing project" tone="warning" value={missingProjectListings} />
          <MetricCard icon={<CircleDot size={18} />} label="Portfolio linked" value={`${linkedRate}%`} />
        </section>

        <section className={styles.layout}>
          <section className={styles.panel} id="project-directory">
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Canonical records</p>
                <h2>Project directory</h2>
              </div>
              <details className={styles.createProject}>
                <summary className={styles.headerLink}>
                  <Plus size={15} />
                  Add project
                  <ChevronDown size={15} />
                </summary>
                <form action={createPropertyProjectAction} className={styles.projectForm}>
                  <ProjectNameDedupeField />
                  <label>
                    <span>Market</span>
                    <select defaultValue="pattaya" name="market">
                      {markets.map((market) => (
                        <option key={market.value} value={market.value}>
                          {market.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Completion year</span>
                    <input min={1900} name="completionYear" placeholder="2025" type="number" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Address or area</span>
                    <input name="address" placeholder="Wongamat Beach, Pattaya" />
                  </label>
                  <AmenitiesSuggestionField className={styles.wideField} />
                  <button type="submit">
                    <Building2 size={15} />
                    Create project
                  </button>
                </form>
              </details>
            </div>

            <form action="/projects#project-directory" className={styles.directoryToolbar} method="get">
              <label className={styles.searchBox}>
                <Search size={17} />
                <input defaultValue={filters.query ?? ""} name="query" placeholder="Search project or developer" type="search" />
              </label>
              <label className={styles.marketSelect}>
                <Building2 size={16} />
                <select defaultValue={filters.market ?? "all"} name="market">
                  <option value="all">All markets</option>
                  {markets.map((market) => (
                    <option key={market.value} value={market.value}>
                      {market.label}
                    </option>
                  ))}
                </select>
              </label>
              <span className={styles.resultMeta}>
                {firstVisible}-{lastVisible} of {projectTotal}
              </span>
              <button className={styles.applyButton} type="submit">
                Apply
              </button>
            </form>

            {projectsError ? (
              <LoadState kicker="Project directory unavailable" message={projectsError} title="Could not load projects" />
            ) : (
              <div className={styles.projectList}>
                {projectItems.length ? (
                  projectItems.map((project) => (
                  <article className={styles.projectCard} key={project.id}>
                    <div className={styles.projectTitle}>
                      <span className={styles.projectIcon}>
                        <Building2 size={18} />
                      </span>
                      <div>
                        <h3>
                          <Link href={`/projects/${encodeURIComponent(project.id)}`}>{project.name}</Link>
                        </h3>
                        <p>
                          {formatBucket(project.market)} · {formatProjectStatus(project.status)}
                          {project.developer ? ` · ${project.developer}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className={styles.projectStats}>
                      <Link href={`/listings?projectId=${encodeURIComponent(project.id)}#inventory`}>{project.listingCount} listings</Link>
                      <span>
                        <Home size={14} />
                        {project.saleCount ?? 0} sale
                      </span>
                      <span>
                        <KeyRound size={14} />
                        {project.rentCount ?? 0} rent
                      </span>
                    </div>
                  </article>
                  ))
                ) : (
                  <div className={styles.emptyState}>No projects yet. Create or import listings with project names to start the registry.</div>
                )}
              </div>
            )}

            {!projectsError && pageCount > 1 ? (
              <div className={styles.pagination} aria-label="Project directory pagination">
                <Link
                  aria-disabled={currentPage === 1}
                  className={currentPage === 1 ? styles.paginationDisabled : ""}
                  href={projectDirectoryHref(filters, Math.max(1, currentPage - 1))}
                >
                  <ChevronLeft size={16} />
                  Prev
                </Link>
                <span>
                  Page {currentPage} of {pageCount}
                </span>
                <Link
                  aria-disabled={currentPage === pageCount}
                  className={currentPage === pageCount ? styles.paginationDisabled : ""}
                  href={projectDirectoryHref(filters, Math.min(pageCount, currentPage + 1))}
                >
                  Next
                  <ChevronRight size={16} />
                </Link>
              </div>
            ) : null}
          </section>

          <aside className={styles.sidePanel}>
            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="section-kicker">Construction</p>
                  <h2>Status mix</h2>
                </div>
              </div>
              <div className={styles.statusList}>
                {statusCounts.length ? (
                  statusCounts.map((item) => (
                    <div className={styles.statusRow} key={item.label}>
                      <span>{formatProjectStatus(item.label)}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))
                ) : (
                  <p>No status data yet.</p>
                )}
              </div>
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className="section-kicker">Cleanup queue</p>
                  <h2>Missing projects</h2>
                </div>
              </div>
              {missingListingsError ? (
                <LoadState
                  kicker="Cleanup queue unavailable"
                  message={missingListingsError}
                  title="Could not load missing projects"
                />
              ) : (
                <div className={styles.gapList}>
                  {missingItems.slice(0, 6).map((listing) => (
                    <Link className={styles.gapRow} href={`/listings/${listing.id}`} key={listing.id}>
                      <AlertTriangle size={15} />
                      <span>
                        <strong>{listing.title}</strong>
                        <small>
                          {formatBucket(listing.market)} · {formatListingType(listing.listingType)}
                          {listing.address ? ` · ${listing.address}` : ""}
                        </small>
                      </span>
                    </Link>
                  ))}
                  {missingItems.length === 0 ? <p>No missing project links.</p> : null}
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}

function projectDirectoryHref(filters: PropertyProjectSearchResponse["filters"], page: number) {
  const params = new URLSearchParams();

  if (filters.query) {
    params.set("query", filters.query);
  }

  if (filters.market) {
    params.set("market", filters.market);
  }

  if (page > 1) {
    params.set("page", String(page));
  }

  const query = params.toString();

  return query ? `/projects?${query}#project-directory` : "/projects#project-directory";
}

function buildProjectStatusCounts(projects: PropertyProjectSearchResponse["items"]) {
  const counts = new Map<PropertyProjectSearchResponse["items"][number]["status"], number>();

  for (const project of projects) {
    counts.set(project.status, (counts.get(project.status) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function MetricCard({
  icon,
  label,
  tone,
  value
}: {
  icon: React.ReactNode;
  label: string;
  tone?: "warning";
  value: number | string;
}) {
  return (
    <article className={`${styles.metricCard} ${tone === "warning" ? styles.warningCard : ""}`}>
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

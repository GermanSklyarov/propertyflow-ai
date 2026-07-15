import Link from "next/link";
import { AlertTriangle, Building2, ChevronDown, CircleDot, Home, KeyRound, Plus } from "lucide-react";
import { formatListingType, formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import { createPropertyProjectAction } from "@entities/project/api/project-actions";
import type { PropertyProjectSearchResponse, PropertySearchResponse } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./projects-page.module.css";

const markets = [
  { label: "Pattaya", value: "pattaya" },
  { label: "Phuket", value: "phuket" },
  { label: "Bangkok", value: "bangkok" },
  { label: "Hua Hin", value: "hua-hin" },
  { label: "Koh Samui", value: "koh-samui" }
];

const projectStatuses = [
  { label: "Completed", value: "completed" },
  { label: "Under construction", value: "under_construction" },
  { label: "Planned", value: "planned" },
  { label: "Paused", value: "paused" }
];

export function ProjectsPage({
  missingListings,
  projects
}: {
  missingListings: PropertySearchResponse;
  projects: PropertyProjectSearchResponse;
}) {
  const projectLinkFacets = missingListings.facets?.projectLink;
  const linkedListings = projectLinkFacets?.linked ?? 0;
  const missingProjectListings = projectLinkFacets?.missing ?? missingListings.total;
  const totalListings = projectLinkFacets?.all ?? linkedListings + missingProjectListings;
  const linkedRate = totalListings > 0 ? Math.round((linkedListings / totalListings) * 100) : 0;
  const statusCounts = projects.facets?.status ?? buildProjectStatusCounts(projects.items);

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
          <span className={styles.totalBadge}>{projects.total} projects</span>
        </header>

        <section className={styles.kpiGrid} aria-label="Project registry health">
          <MetricCard icon={<Building2 size={18} />} label="Known projects" value={projects.total} />
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
                  <label className={styles.wideField}>
                    <span>Project name</span>
                    <input name="name" placeholder="The Riviera Wongamat" required />
                  </label>
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
                    <span>Status</span>
                    <select defaultValue="completed" name="status">
                      {projectStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Developer</span>
                    <input name="developer" placeholder="Riviera Group" />
                  </label>
                  <label>
                    <span>Completion year</span>
                    <input min={1900} name="completionYear" placeholder="2025" type="number" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Address or area</span>
                    <input name="address" placeholder="Wongamat Beach, Pattaya" />
                  </label>
                  <label className={styles.wideField}>
                    <span>Shared amenities</span>
                    <input name="amenities" placeholder="pool, gym, lobby, parking" />
                  </label>
                  <button type="submit">
                    <Building2 size={15} />
                    Create project
                  </button>
                </form>
              </details>
            </div>

            <div className={styles.projectList}>
              {projects.items.length ? (
                projects.items.map((project) => (
                  <article className={styles.projectCard} key={project.id}>
                    <div className={styles.projectTitle}>
                      <span className={styles.projectIcon}>
                        <Building2 size={18} />
                      </span>
                      <div>
                        <h3>{project.name}</h3>
                        <p>
                          {formatBucket(project.market)} · {formatProjectStatus(project.status)}
                          {project.developer ? ` · ${project.developer}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className={styles.projectStats}>
                      <span>{project.listingCount} listings</span>
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
              <div className={styles.gapList}>
                {missingListings.items.slice(0, 6).map((listing) => (
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
                {missingListings.items.length === 0 ? <p>No missing project links.</p> : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
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

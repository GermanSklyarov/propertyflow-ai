import Link from "next/link";
import { AlertTriangle, Building2, CircleDot, Home, KeyRound } from "lucide-react";
import { buildListingProjectCoverage } from "@entities/listing/lib/listing-projects";
import { formatListingType, formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./projects-page.module.css";

export function ProjectsPage({ listings, total }: { listings: PropertySnapshot[]; total: number }) {
  const coverage = buildListingProjectCoverage(listings);
  const linkedRate = total > 0 ? Math.round((coverage.linkedListings / total) * 100) : 0;

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
          <span className={styles.totalBadge}>{coverage.projects.length} projects</span>
        </header>

        <section className={styles.kpiGrid} aria-label="Project registry health">
          <MetricCard icon={<Building2 size={18} />} label="Known projects" value={coverage.projects.length} />
          <MetricCard icon={<Home size={18} />} label="Linked listings" value={coverage.linkedListings} />
          <MetricCard icon={<AlertTriangle size={18} />} label="Missing project" tone="warning" value={coverage.missingProjectListings} />
          <MetricCard icon={<CircleDot size={18} />} label="Portfolio linked" value={`${linkedRate}%`} />
        </section>

        <section className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Canonical records</p>
                <h2>Project directory</h2>
              </div>
              <Link className={styles.headerLink} href="/listings#create-listing">
                Add listing
              </Link>
            </div>

            <div className={styles.projectList}>
              {coverage.projects.length ? (
                coverage.projects.map((project) => (
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
                        {project.saleCount} sale
                      </span>
                      <span>
                        <KeyRound size={14} />
                        {project.rentCount} rent
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
                {coverage.statusCounts.length ? (
                  coverage.statusCounts.map((item) => (
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
                {coverage.missingProjectItems.slice(0, 6).map((listing) => (
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
                {coverage.missingProjectItems.length === 0 ? <p>No missing project links.</p> : null}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
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

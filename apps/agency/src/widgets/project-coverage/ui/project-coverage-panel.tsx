import { AlertTriangle, Building2, CircleDot, Home, KeyRound } from "lucide-react";
import { buildListingProjectCoverage } from "@entities/listing/lib/listing-projects";
import { formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import type { PropertySnapshot } from "@propertyflow/domain";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./project-coverage-panel.module.css";

export function ProjectCoveragePanel({ listings }: { listings: PropertySnapshot[] }) {
  const coverage = buildListingProjectCoverage(listings);
  const coverageRate = listings.length > 0 ? Math.round((coverage.linkedListings / listings.length) * 100) : 0;
  const topProjects = coverage.projects.slice(0, 4);

  return (
    <section className={styles.panel} aria-label="Project coverage">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Development projects</p>
          <h2>Project coverage</h2>
          <p>Keep listings attached to existing projects so agents do not create duplicates during manual entry or imports.</p>
        </div>
        <div className={styles.coverageBadge}>
          <strong>{coverageRate}%</strong>
          <span>linked</span>
        </div>
      </div>

      <div className={styles.grid}>
        <div className={styles.summaryCard}>
          <Building2 size={18} />
          <strong>{coverage.projects.length}</strong>
          <span>known projects</span>
        </div>
        <div className={styles.summaryCard}>
          <Home size={18} />
          <strong>{coverage.linkedListings}</strong>
          <span>linked listings</span>
        </div>
        <div className={`${styles.summaryCard} ${coverage.missingProjectListings > 0 ? styles.warningCard : ""}`}>
          <AlertTriangle size={18} />
          <strong>{coverage.missingProjectListings}</strong>
          <span>missing project</span>
        </div>
      </div>

      <div className={styles.body}>
        <div className={styles.projectList}>
          {topProjects.length ? (
            topProjects.map((project) => (
              <article className={styles.projectRow} key={project.id}>
                <div className={styles.projectTitle}>
                  <CircleDot size={16} />
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
                    {project.saleCount}
                  </span>
                  <span>
                    <KeyRound size={14} />
                    {project.rentCount}
                  </span>
                </div>
              </article>
            ))
          ) : (
            <div className={styles.emptyState}>
              <Building2 size={18} />
              <span>No projects linked yet. Start typing a project name in the listing form to reuse or create one.</span>
            </div>
          )}
        </div>

        <div className={styles.statusList}>
          <h3>Construction status</h3>
          {coverage.statusCounts.length ? (
            coverage.statusCounts.map((item) => (
              <div className={styles.statusRow} key={item.label}>
                <span>{formatProjectStatus(item.label)}</span>
                <strong>{item.count}</strong>
              </div>
            ))
          ) : (
            <p>No project status data yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

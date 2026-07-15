import Link from "next/link";
import { ArrowLeft, Building2, Home, KeyRound, MapPin, Ruler, Sparkles } from "lucide-react";
import { formatListingMoney, formatListingType, formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import { buildListingCoverImageSrc } from "@entities/listing/lib/listing-media";
import { updatePropertyProjectRecordAction } from "@entities/project/api/project-actions";
import type { PropertyProjectSuggestion, PropertySearchResponse } from "@propertyflow/contracts";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./project-detail-page.module.css";

export function ProjectDetailPage({
  listings,
  project
}: {
  listings: PropertySearchResponse;
  project: PropertyProjectSuggestion;
}) {
  const updateAction = updatePropertyProjectRecordAction.bind(null, project.id);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <Link className={styles.backLink} href="/projects#project-directory">
              <ArrowLeft size={16} />
              Back to projects
            </Link>
            <p className="section-kicker">Canonical project</p>
            <h1>{project.name}</h1>
            <p>
              {formatBucket(project.market)} · {formatProjectStatus(project.status)}
              {project.developer ? ` · ${project.developer}` : ""}
            </p>
          </div>
          <Link className={styles.headerAction} href={`/listings?projectId=${encodeURIComponent(project.id)}#inventory`}>
            View inventory
          </Link>
        </header>

        <section className={styles.kpiGrid} aria-label="Project listing mix">
          <MetricCard icon={<Building2 size={18} />} label="Linked listings" value={project.listingCount} />
          <MetricCard icon={<Home size={18} />} label="Sale supply" value={project.saleCount ?? 0} />
          <MetricCard icon={<KeyRound size={18} />} label="Rental supply" value={project.rentCount ?? 0} />
          <MetricCard icon={<Sparkles size={18} />} label="Registry status" value={formatProjectStatus(project.status)} />
        </section>

        <section className={styles.layout}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Project record</p>
                <h2>Development profile</h2>
              </div>
            </div>
            <div className={styles.factGrid}>
              <Fact label="Market" value={formatBucket(project.market)} />
              <Fact label="Status" value={formatProjectStatus(project.status)} />
              <Fact label="Developer" value={project.developer ?? "Not captured yet"} />
              <Fact label="Address / area" value={project.address ?? "Use listing addresses until project address is confirmed."} />
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Canonical edit</p>
                <h2>Update project record</h2>
              </div>
            </div>
            <form action={updateAction} className={styles.projectForm}>
              <label>
                <span>Project name</span>
                <input defaultValue={project.name} name="name" required />
              </label>
              <label>
                <span>Status</span>
                <select defaultValue={project.status} name="status">
                  <option value="planned">Planned</option>
                  <option value="under_construction">Under construction</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                </select>
              </label>
              <label>
                <span>Developer</span>
                <input defaultValue={project.developer ?? ""} name="developer" placeholder="Developer or group" />
              </label>
              <label>
                <span>Completion year</span>
                <input min={1900} name="completionYear" placeholder="2026" type="number" />
              </label>
              <label className={styles.wideField}>
                <span>Address or area</span>
                <input defaultValue={project.address ?? ""} name="address" placeholder="Wongamat Beach, Pattaya" />
              </label>
              <label className={styles.wideField}>
                <span>Shared amenities</span>
                <input name="amenities" placeholder="pool, gym, lobby, parking" />
              </label>
              <button type="submit">Save project</button>
            </form>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className="section-kicker">Linked inventory</p>
                <h2>{listings.total} listings in this project</h2>
              </div>
              <Link className={styles.secondaryAction} href={`/listings?projectId=${encodeURIComponent(project.id)}#inventory`}>
                Open queue
              </Link>
            </div>

            <div className={styles.listingGrid}>
              {listings.items.map((listing) => (
                <Link className={styles.listingCard} href={`/listings/${listing.id}`} key={listing.id}>
                  <img alt={`${listing.title} cover`} src={buildListingCoverImageSrc(listing)} />
                  <div>
                    <h3>{listing.title}</h3>
                    <p>
                      <MapPin size={14} />
                      {listing.address ?? formatBucket(listing.market)}
                    </p>
                    <div className={styles.listingMeta}>
                      <span>
                        <Ruler size={14} />
                        {listing.areaSqm} sqm
                      </span>
                      <span>{listing.bedrooms} bd</span>
                      <span>{listing.bathrooms} ba</span>
                    </div>
                    <strong>{formatListingMoney(listing.price)}</strong>
                    <small>{formatListingType(listing.listingType)}</small>
                  </div>
                </Link>
              ))}
              {listings.items.length === 0 ? (
                <div className={styles.emptyState}>No listings are linked to this project yet. Attach listings from the inventory queue.</div>
              ) : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <article className={styles.metricCard}>
      {icon}
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

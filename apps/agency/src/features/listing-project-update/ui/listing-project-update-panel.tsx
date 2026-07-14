import { Building2, Save } from "lucide-react";
import { updatePropertyProjectAction } from "@entities/listing/api/listing-actions";
import { formatProjectStatus } from "@entities/listing/lib/listing-formatters";
import { ProjectAutocompleteField } from "@features/listing-create/ui/project-autocomplete-field";
import type { PropertySnapshot } from "@propertyflow/domain";
import styles from "./listing-project-update-panel.module.css";

export function ListingProjectUpdatePanel({ listing }: { listing: PropertySnapshot }) {
  return (
    <section className={styles.panel} id="development-project">
      <div className={styles.header}>
        <div>
          <p className="section-kicker">Development project</p>
          <h2>Project link</h2>
          <p>Attach this listing to an existing project or create a normalized project record from the same field.</p>
        </div>
        <Building2 size={22} />
      </div>

      {listing.project ? (
        <div className={styles.currentProject}>
          <strong>{listing.project.name}</strong>
          <span>
            {formatProjectStatus(listing.project.status)}
            {listing.project.developer ? ` · ${listing.project.developer}` : ""}
          </span>
        </div>
      ) : (
        <div className={styles.missingProject}>
          <strong>No project linked</strong>
          <span>This listing appears in the missing project cleanup queue.</span>
        </div>
      )}

      <form action={updatePropertyProjectAction.bind(null, listing.id)} className={styles.form}>
        <ProjectAutocompleteField
          initialProject={
            listing.project
              ? {
                  developer: listing.project.developer,
                  name: listing.project.name,
                  status: listing.project.status
                }
              : undefined
          }
          market={listing.market}
        />
        <label className={styles.noteField}>
          <span>Internal note</span>
          <input name="note" placeholder="Optional: project corrected after import" />
        </label>
        <div className={styles.actions}>
          <button className={styles.saveButton} type="submit">
            <Save size={16} />
            Save project
          </button>
          <small>Clear the project name and save to unlink this listing from a project.</small>
        </div>
      </form>
    </section>
  );
}

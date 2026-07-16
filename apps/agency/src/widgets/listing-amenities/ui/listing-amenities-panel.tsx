import { CheckCircle2, Save, Sparkles } from "lucide-react";
import { updatePropertyAmenitiesAction } from "@entities/listing/api/listing-actions";
import { AmenitiesSuggestionField } from "@features/project-create/ui/amenities-suggestion-field";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./listing-amenities-panel.module.css";

export function ListingAmenitiesPanel({
  amenities,
  appliedImageAnalysisAssetId,
  listingId,
  updated
}: {
  amenities: string[];
  appliedImageAnalysisAssetId?: string;
  listingId: string;
  updated?: boolean;
}) {
  const updateAction = updatePropertyAmenitiesAction.bind(null, listingId);

  return (
    <section className={styles.panel} id="amenities">
      <div className={styles.panelHeader}>
        <div>
          <p className="section-kicker">Amenities</p>
          <h2 className={styles.panelTitle}>Client-facing tags</h2>
        </div>
        <Sparkles size={20} />
      </div>
      {appliedImageAnalysisAssetId ? (
        <div className={styles.amenitiesNotice}>
          <CheckCircle2 size={18} />
          <div>
            <strong>AI features applied</strong>
            <p>Client-facing tags were updated from the approved image analysis.</p>
          </div>
        </div>
      ) : null}
      {updated ? (
        <div className={styles.amenitiesNotice}>
          <CheckCircle2 size={18} />
          <div>
            <strong>Amenities saved</strong>
            <p>Client-facing tags were normalized and the listing search index was queued for refresh.</p>
          </div>
        </div>
      ) : null}
      <div className={styles.chipGrid}>
        {amenities.length ? amenities.map((amenity) => <span key={amenity}>{formatBucket(amenity)}</span>) : <span>Add amenities before publishing</span>}
      </div>
      <form action={updateAction} className={styles.form}>
        <AmenitiesSuggestionField
          defaultValue={amenities.join(", ")}
          label="Edit client-facing tags"
          placeholder="pool, gym, sea view, fiber internet"
        />
        <label className={styles.noteField}>
          <span>Change note</span>
          <input name="note" placeholder="Optional: cleaned up after photo review" />
        </label>
        <button type="submit">
          <Save size={16} />
          Save amenities
        </button>
      </form>
    </section>
  );
}

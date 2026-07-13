import { CheckCircle2, Sparkles } from "lucide-react";
import { formatBucket } from "@shared/lib/formatters";
import styles from "./listing-amenities-panel.module.css";

export function ListingAmenitiesPanel({
  amenities,
  appliedImageAnalysisAssetId
}: {
  amenities: string[];
  appliedImageAnalysisAssetId?: string;
}) {
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
      <div className={styles.chipGrid}>
        {amenities.length ? amenities.map((amenity) => <span key={amenity}>{formatBucket(amenity)}</span>) : <span>Add amenities before publishing</span>}
      </div>
    </section>
  );
}

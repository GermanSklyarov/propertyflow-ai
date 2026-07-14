import { CreateListingForm } from "@features/listing-create/ui/create-listing-form";
import { ListingBulkImportPanel } from "@features/listing-bulk-import/ui/listing-bulk-import-panel";
import type { BackgroundJobMonitorItem } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { ListingsInventoryPanel } from "@widgets/listings-inventory/ui/listings-inventory-panel";
import { ProjectCoveragePanel } from "@widgets/project-coverage/ui/project-coverage-panel";
import styles from "./listings-page.module.css";

interface ListingsPageProps {
  importJobs: BackgroundJobMonitorItem[];
  importResult?: {
    error?: "empty";
    jobId?: string;
  };
  listings: PropertySnapshot[];
  total: number;
}

export function ListingsPage({ importJobs, importResult, listings, total }: ListingsPageProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <p className="section-kicker">Inventory operations</p>
            <h1 className={styles.title}>Listings control room</h1>
            <p className={styles.subtitle}>
              Track sale and rental supply, publication status, AI readiness, rent economics, and missing listing signals.
            </p>
          </div>
          <span className={styles.totalBadge}>{total} listings</span>
        </header>

        <CreateListingForm />

        <ListingBulkImportPanel jobs={importJobs} result={importResult} />

        <ProjectCoveragePanel listings={listings} />

        <ListingsInventoryPanel listings={listings} />
      </div>
    </main>
  );
}

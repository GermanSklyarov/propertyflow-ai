import { CreateListingForm } from "@features/listing-create/ui/create-listing-form";
import type { PropertySnapshot } from "@propertyflow/domain";
import { ListingsInventoryPanel } from "@widgets/listings-inventory/ui/listings-inventory-panel";
import styles from "./listings-page.module.css";

export function ListingsPage({ listings, total }: { listings: PropertySnapshot[]; total: number }) {
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

        <ListingsInventoryPanel listings={listings} />
      </div>
    </main>
  );
}

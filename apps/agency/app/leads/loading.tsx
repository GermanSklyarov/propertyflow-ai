import { PageLoadState } from "@shared/ui/page-load-state";

export default function LoadingLeadsPage() {
  return (
    <PageLoadState
      kicker="Next best work"
      message="Syncing lead search, filters, owners, and follow-up queue."
      title="Loading follow-up queue"
    />
  );
}

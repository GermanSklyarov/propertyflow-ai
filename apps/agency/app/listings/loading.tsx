import { PageLoadState } from "@shared/ui/page-load-state";

export default function LoadingListingsPage() {
  return (
    <PageLoadState
      kicker="Inventory operations"
      message="Loading inventory, import jobs, project coverage, and listing health signals."
      title="Loading listings control room"
    />
  );
}

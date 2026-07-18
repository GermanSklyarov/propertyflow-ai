import { PageLoadState } from "@shared/ui/page-load-state";

export default function LoadingProjectsPage() {
  return (
    <PageLoadState
      kicker="Development registry"
      message="Loading canonical projects, status mix, and missing project cleanup queue."
      title="Loading projects workspace"
    />
  );
}

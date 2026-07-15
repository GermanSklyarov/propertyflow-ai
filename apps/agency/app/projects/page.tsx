import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { projectsQueryOptions } from "@entities/project/api/project-queries";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ProjectsPage } from "@views/projects/ui/projects-page";
import type { PropertyProjectSearchRequest } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";

const PAGE_SIZE = 8;
const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export default async function AgencyProjectsPage({
  searchParams
}: {
  searchParams: Promise<{
    market?: ThailandMarket | "all";
    page?: string;
    query?: string;
  }>;
}) {
  const params = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const market = params.market && markets.includes(params.market as ThailandMarket) ? (params.market as ThailandMarket) : undefined;
  const projectRequest: PropertyProjectSearchRequest = {
    limit: PAGE_SIZE,
    market,
    offset: (page - 1) * PAGE_SIZE,
    query: params.query?.trim() || undefined
  };
  const [projectsResult, missingListingsResult] = await Promise.allSettled([
    queryClient.ensureQueryData(projectsQueryOptions(projectRequest)),
    queryClient.ensureQueryData(listingsQueryOptions({ limit: 12, projectLink: "missing", sort: "created-desc" }))
  ]);
  const projects =
    projectsResult.status === "fulfilled" ? projectsResult.value : { filters: projectRequest, items: [], total: 0 };
  const missingListings =
    missingListingsResult.status === "fulfilled"
      ? missingListingsResult.value
      : { filters: { limit: 12, projectLink: "missing" as const, sort: "created-desc" as const }, items: [], total: 0 };

  return <ProjectsPage missingListings={missingListings} projects={projects} />;
}

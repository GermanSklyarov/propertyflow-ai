import { backgroundJobsQueryOptions } from "@entities/jobs/api/job-queries";
import { knowledgeDocumentsQueryOptions, listingSourcesQueryOptions } from "@entities/knowledge/api/knowledge-queries";
import { listingsQueryOptions } from "@entities/listing/api/listing-queries";
import { currentTenantQueryOptions } from "@entities/tenant/api/tenant-queries";
import type { PropertySearchRequest, PropertySearchSort } from "@propertyflow/contracts";
import { getLocationEnrichmentStatus } from "@shared/api/agency-client";
import { canAccessTenantPlan, crmTenantPlans } from "@shared/lib/tenant-plan-access";
import { requireAgencySession } from "@shared/lib/tenant-session";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";
import { ListingsPage } from "@views/listings/ui/listings-page";
import { StarterListingsPage } from "@views/listings/ui/starter-listings-page";

const PAGE_SIZE = 8;
const STARTER_LISTING_PAGE_SIZE = 24;
const STARTER_LISTING_MAX_LIMIT = 1000;
const listingSorts: PropertySearchSort[] = ["created-desc", "price-asc", "price-desc", "rent-asc", "yield-desc"];

export default async function AgencyListingsPage({
  searchParams
}: {
  searchParams: Promise<{
    importError?: "empty";
    importJob?: string;
    listingLimit?: string;
    page?: string;
    projectId?: string;
    projectLink?: PropertySearchRequest["projectLink"];
    query?: string;
    sort?: PropertySearchSort;
  }>;
}) {
  const query = await searchParams;
  const queryClient = createPropertyFlowQueryClient();
  const { tenantId } = await requireAgencySession();
  const tenant = await queryClient.ensureQueryData(currentTenantQueryOptions(tenantId));

  const page = Math.max(1, Number(query.page ?? 1) || 1);
  const sort = query.sort && listingSorts.includes(query.sort) ? query.sort : "created-desc";
  const projectLink =
    query.projectLink === "linked" || query.projectLink === "missing" || query.projectLink === "all"
      ? query.projectLink
      : "all";
  const inventoryRequest: PropertySearchRequest = {
    limit: PAGE_SIZE,
    offset: (page - 1) * PAGE_SIZE,
    projectId: query.projectId?.trim() || undefined,
    projectLink,
    query: query.query?.trim() || undefined,
    sort
  };
  const coverageRequest: PropertySearchRequest = { limit: 200, sort: "created-desc" };
  const [jobsResult, locationEnrichmentResult] = await Promise.allSettled([
    queryClient.ensureQueryData(backgroundJobsQueryOptions({ limit: 20 }, tenantId)),
    getLocationEnrichmentStatus({ tenantId })
  ]);
  const importResult = query.importJob || query.importError ? { error: query.importError, jobId: query.importJob } : undefined;
  const jobs = jobsResult.status === "fulfilled" ? jobsResult.value : { items: [] };
  const importJobs = jobs.items.filter((job) => job.name === "properties.import").slice(0, 5);
  const locationEnrichmentJobs = jobs.items
    .filter((job) => job.name === "properties.location.enrich_existing" || job.name === "properties.location.enrich")
    .slice(0, 5);
  const locationEnrichmentStatus = locationEnrichmentResult.status === "fulfilled" ? locationEnrichmentResult.value : undefined;

  if (!canAccessTenantPlan(tenant.subscriptionPlan, crmTenantPlans)) {
    const listingLimit = resolveStarterListingLimit(query.listingLimit);
    const [listingDocumentsResult, listingSourcesResult] = await Promise.allSettled([
      queryClient.ensureQueryData(knowledgeDocumentsQueryOptions({ tag: "property-listing", limit: listingLimit }, tenantId)),
      queryClient.ensureQueryData(listingSourcesQueryOptions(tenantId))
    ]);
    const listingDocuments = listingDocumentsResult.status === "fulfilled" ? listingDocumentsResult.value : { items: [], total: 0 };
    const listingSources = listingSourcesResult.status === "fulfilled" ? listingSourcesResult.value : { items: [] };
    const nextListingLimit = Math.min(listingLimit + STARTER_LISTING_PAGE_SIZE, STARTER_LISTING_MAX_LIMIT, listingDocuments.total);

    return (
      <StarterListingsPage
        importJobs={importJobs}
        importResult={importResult}
        listingDocuments={listingDocuments.items}
        listingSources={listingSources.items}
        locationEnrichmentJobs={locationEnrichmentJobs}
        locationEnrichmentStatus={locationEnrichmentStatus}
        showMoreHref={nextListingLimit > listingDocuments.items.length ? buildStarterListingHref(query, nextListingLimit) : undefined}
        totalListingDocuments={listingDocuments.total}
      />
    );
  }

  const [inventoryResult, coverageResult] = await Promise.allSettled([
    queryClient.ensureQueryData(listingsQueryOptions(inventoryRequest, tenantId)),
    queryClient.ensureQueryData(listingsQueryOptions(coverageRequest, tenantId))
  ]);
  const inventory = inventoryResult.status === "fulfilled" ? inventoryResult.value : undefined;
  const coverage = coverageResult.status === "fulfilled" ? coverageResult.value : undefined;
  const inventoryError = inventoryResult.status === "rejected" ? toErrorMessage(inventoryResult.reason) : undefined;

  return (
    <ListingsPage
      coverageListings={coverage?.items ?? []}
      importJobs={importJobs}
      importResult={importResult}
      inventory={inventory}
      inventoryError={inventoryError}
      locationEnrichmentJobs={locationEnrichmentJobs}
      locationEnrichmentStatus={locationEnrichmentStatus}
      projectLinkFacets={coverage?.facets?.projectLink ?? inventory?.facets?.projectLink}
      total={coverage?.total ?? inventory?.total ?? 0}
    />
  );
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Failed to load listings";
}

function resolveStarterListingLimit(value?: string) {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed)) {
    return STARTER_LISTING_PAGE_SIZE;
  }

  return Math.min(Math.max(parsed, STARTER_LISTING_PAGE_SIZE), STARTER_LISTING_MAX_LIMIT);
}

function buildStarterListingHref(
  query: {
    importError?: "empty";
    importJob?: string;
    listingLimit?: string;
  },
  listingLimit: number
) {
  const params = new URLSearchParams();

  if (query.importError) {
    params.set("importError", query.importError);
  }

  if (query.importJob) {
    params.set("importJob", query.importJob);
  }

  params.set("listingLimit", String(listingLimit));

  return `/listings?${params.toString()}`;
}

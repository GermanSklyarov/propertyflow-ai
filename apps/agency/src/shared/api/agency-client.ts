import type {
  BackgroundJobMonitorResponse,
  BackgroundJobMonitorItem,
  BackgroundJobSnapshot,
  BackgroundJobState,
  AssignLeadRequest,
  ApplyLeadQualityContactRequest,
  ApplyLeadQualityContactResponse,
  ApplyLeadQualityLinkPropertyRequest,
  ApplyLeadQualityLinkPropertyResponse,
  GeneratePropertySocialPostsRequest,
  GeneratePropertySocialPostsResponse,
  RecordPropertySocialPostPublicationRequest,
  RecordPropertySocialPostPublicationResponse,
  RecordPropertySocialPostReviewRequest,
  RecordPropertySocialPostReviewResponse,
  SavePropertySocialPostDraftRequest,
  SavePropertySocialPostDraftResponse,
  AiChatRequest,
  AiChatResponse,
  AmenitySuggestionRequest,
  AmenitySuggestionResponse,
  CreateKnowledgeDocumentRequest,
  CreateLeadNoteRequest,
  CreatePropertyImportUploadRequest,
  CreatePropertyImportUploadResponse,
  CreatePropertyProjectRequest,
  CreatePropertyRequest,
  KnowledgeChunkEmbeddingJobPayload,
  KnowledgeChunkSearchRequest,
  KnowledgeChunkSearchResponse,
  KnowledgeDocumentListResponse,
  KnowledgeDocumentSnapshot,
  LeadListResponse,
  LeadNoteSnapshot,
  LeadNotesResponse,
  LeadQueueSummaryResponse,
  LeadSnapshot,
  LeadTimelineResponse,
  ListLeadsRequest,
  AddPropertyImageRequest,
  ConfirmPropertyImageUploadRequest,
  CreatePropertyImageUploadRequest,
  CreatePropertyImageUploadResponse,
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageGalleryResponse,
  PropertyImageAnalysisResult,
  PropertyImageSnapshot,
  PropertyImportJobPayload,
  PropertyProjectSuggestion,
  PropertyProjectSearchRequest,
  PropertyProjectSearchResponse,
  PropertySearchRequest,
  PropertySearchResponse,
  PropertySocialPostPublicationListResponse,
  PropertySocialPostReviewListResponse,
  ReviewAiAssetRequest,
  RunListingAssistantRequest,
  RunListingAssistantResponse,
  SavedPropertySearchListResponse,
  SavedSearchAlertAnalyticsResponse,
  SavedSearchOpportunitiesResponse,
  TenantDashboardMetrics,
  TenantSnapshot,
  TenantUserSnapshot,
  TenantUsageResponse,
  UpdateLeadFollowUpRequest,
  UpdateLeadStatusRequest,
  UpdatePropertyAmenitiesRequest,
  UpdateGeneratedPropertyDescriptionRequest,
  UpdatePropertyImageAnalysisRequest,
  UpdatePropertyProjectRecordRequest,
  UpdatePropertyProjectRequest,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";

const apiBaseUrl =
  process.env.PROPERTYFLOW_API_URL ?? process.env.NEXT_PUBLIC_PROPERTYFLOW_API_URL ?? "http://127.0.0.1:3001";

const demoHeaders = {
  "x-tenant-id": process.env.PROPERTYFLOW_TENANT_ID ?? "demo-agency",
  "x-user-id": process.env.PROPERTYFLOW_USER_ID ?? "manager-demo-1",
  "x-user-role": process.env.PROPERTYFLOW_USER_ROLE ?? "manager"
};

export async function getTenantDashboardMetrics(): Promise<TenantDashboardMetrics> {
  try {
    const response = await fetch(`${apiBaseUrl}/analytics/dashboard`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoTenantDashboardMetrics();
    }

    return (await response.json()) as TenantDashboardMetrics;
  } catch {
    return demoTenantDashboardMetrics();
  }
}

export async function listBackgroundJobs(
  request: { limit?: number; states?: BackgroundJobState[] } = { limit: 12 },
  options: { revalidateSeconds?: number | false } = {}
): Promise<BackgroundJobMonitorResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/jobs${toQueryString(request)}`, {
      headers: demoHeaders,
      ...(options.revalidateSeconds === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidateSeconds ?? 5 } })
    });

    if (!response.ok) {
      return demoBackgroundJobs(request);
    }

    return (await response.json()) as BackgroundJobMonitorResponse;
  } catch {
    return demoBackgroundJobs(request);
  }
}

export async function getBackgroundJob(
  jobId: string,
  options: { revalidateSeconds?: number | false } = {}
): Promise<BackgroundJobMonitorItem | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/jobs/${encodeURIComponent(jobId)}`, {
      headers: demoHeaders,
      ...(options.revalidateSeconds === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidateSeconds ?? 5 } })
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as BackgroundJobMonitorItem;
  } catch {
    return null;
  }
}

export async function searchPropertyProjects(
  request: PropertyProjectSearchRequest = { limit: 8 },
  options: { revalidateSeconds?: number | false } = {}
): Promise<PropertyProjectSearchResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/projects${toQueryString(request)}`, {
      headers: demoHeaders,
      ...(options.revalidateSeconds === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidateSeconds ?? 10 } })
    });

    if (!response.ok) {
      return demoPropertyProjectSearchResponse(request);
    }

    return (await response.json()) as PropertyProjectSearchResponse;
  } catch {
    return demoPropertyProjectSearchResponse(request);
  }
}

export async function getPropertyProject(projectId: string): Promise<PropertyProjectSuggestion | null> {
  const response = await fetch(`${apiBaseUrl}/properties/projects/${encodeURIComponent(projectId)}`, {
    headers: demoHeaders,
    cache: "no-store"
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`Failed to load property project: ${response.status}`);
  }

  return (await response.json()) as PropertyProjectSuggestion;
}

export async function createPropertyProject(request: CreatePropertyProjectRequest): Promise<PropertyProjectSuggestion> {
  const response = await fetch(`${apiBaseUrl}/properties/projects`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create property project: ${response.status}`);
  }

  return (await response.json()) as PropertyProjectSuggestion;
}

export async function updatePropertyProjectRecord(
  projectId: string,
  request: UpdatePropertyProjectRecordRequest
): Promise<PropertyProjectSuggestion> {
  const response = await fetch(`${apiBaseUrl}/properties/projects/${encodeURIComponent(projectId)}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update property project: ${response.status}`);
  }

  return (await response.json()) as PropertyProjectSuggestion;
}

export async function searchAmenities(
  request: AmenitySuggestionRequest = { limit: 12 },
  options: { revalidateSeconds?: number | false } = {}
): Promise<AmenitySuggestionResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/amenities${toQueryString(request)}`, {
      headers: demoHeaders,
      ...(options.revalidateSeconds === false
        ? { cache: "no-store" as const }
        : { next: { revalidate: options.revalidateSeconds ?? 10 } })
    });

    if (!response.ok) {
      return demoAmenitySuggestions(request);
    }

    return (await response.json()) as AmenitySuggestionResponse;
  } catch {
    return demoAmenitySuggestions(request);
  }
}

function demoAmenitySuggestions(request: AmenitySuggestionRequest): AmenitySuggestionResponse {
  return {
    filters: request,
    items: [],
    total: 0
  };
}

function demoPropertyProjectSearchResponse(request: PropertyProjectSearchRequest): PropertyProjectSearchResponse {
  return {
    facets: { status: [] },
    filters: request,
    items: [],
    total: 0
  };
}

function demoBackgroundJobs(request: { states?: BackgroundJobState[] } = {}): BackgroundJobMonitorResponse {
  return {
    items: [],
    states: request.states ?? ["active", "waiting", "completed", "failed"],
    total: 0
  };
}

export async function listLeads(request: ListLeadsRequest = { limit: 24 }): Promise<LeadListResponse> {
  const response = await fetch(`${apiBaseUrl}/leads${toQueryString(request)}`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load leads: ${response.status}`);
  }

  return (await response.json()) as LeadListResponse;
}

export async function getLeadQueueSummary(
  request: ListLeadsRequest = { limit: 24 }
): Promise<LeadQueueSummaryResponse> {
  const response = await fetch(`${apiBaseUrl}/leads/queue-summary${toQueryString(request)}`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load lead queue summary: ${response.status}`);
  }

  return (await response.json()) as LeadQueueSummaryResponse;
}

export async function getLead(leadId: string): Promise<LeadSnapshot | null> {
  const response = await fetch(`${apiBaseUrl}/leads?limit=100`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load lead: ${response.status}`);
  }

  const body = (await response.json()) as LeadListResponse;

  return body.items.find((lead) => lead.id === leadId) ?? null;
}

export async function getLeadTimeline(leadId: string): Promise<LeadTimelineResponse> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/timeline`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load lead timeline: ${response.status}`);
  }

  return (await response.json()) as LeadTimelineResponse;
}

export async function getLeadNotes(leadId: string): Promise<LeadNotesResponse> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/notes`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load lead notes: ${response.status}`);
  }

  return (await response.json()) as LeadNotesResponse;
}

export async function listLeadAgents(): Promise<TenantUserSnapshot[]> {
  const response = await fetch(`${apiBaseUrl}/leads/agents`, {
    headers: demoHeaders,
    next: { revalidate: 60 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load lead agents: ${response.status}`);
  }

  return (await response.json()) as TenantUserSnapshot[];
}

export async function addLeadNote(leadId: string, payload: CreateLeadNoteRequest): Promise<LeadNoteSnapshot> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/notes`, {
    method: "POST",
    headers: {
      ...demoHeaders,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to add lead note: ${response.status}`);
  }

  return (await response.json()) as LeadNoteSnapshot;
}

export async function updateLeadStatus(leadId: string, payload: UpdateLeadStatusRequest): Promise<LeadSnapshot> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/status`, {
    method: "PATCH",
    headers: {
      ...demoHeaders,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to update lead status: ${response.status}`);
  }

  return (await response.json()) as LeadSnapshot;
}

export async function updateLeadFollowUp(leadId: string, payload: UpdateLeadFollowUpRequest): Promise<LeadSnapshot> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/follow-up`, {
    method: "PATCH",
    headers: {
      ...demoHeaders,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to update lead follow-up: ${response.status}`);
  }

  return (await response.json()) as LeadSnapshot;
}

export async function assignLead(leadId: string, payload: AssignLeadRequest): Promise<LeadSnapshot> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/assign`, {
    method: "PATCH",
    headers: {
      ...demoHeaders,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to assign lead: ${response.status}`);
  }

  return (await response.json()) as LeadSnapshot;
}

export async function updateLeadContact(
  leadId: string,
  payload: ApplyLeadQualityContactRequest
): Promise<ApplyLeadQualityContactResponse> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/quality-actions/contact`, {
    method: "POST",
    headers: {
      ...demoHeaders,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to update lead contact: ${response.status}`);
  }

  return (await response.json()) as ApplyLeadQualityContactResponse;
}

export async function linkLeadProperty(
  leadId: string,
  payload: ApplyLeadQualityLinkPropertyRequest
): Promise<ApplyLeadQualityLinkPropertyResponse> {
  const response = await fetch(`${apiBaseUrl}/leads/${leadId}/quality-actions/link-property`, {
    method: "POST",
    headers: {
      ...demoHeaders,
      "content-type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Failed to link lead property: ${response.status}`);
  }

  return (await response.json()) as ApplyLeadQualityLinkPropertyResponse;
}

export async function listProperties(
  request: PropertySearchRequest = { limit: 30, sort: "created-desc" }
): Promise<PropertySearchResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties${toQueryString(request)}`, {
      headers: demoHeaders,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Failed to load properties: ${response.status}`);
    }

    return (await response.json()) as PropertySearchResponse;
  } catch (error) {
    throw error instanceof Error ? error : new Error("Failed to load properties");
  }
}

export async function createProperty(request: CreatePropertyRequest): Promise<PropertySnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create property: ${response.status}`);
  }

  return (await response.json()) as PropertySnapshot;
}

export async function updatePropertyProject(
  propertyId: string,
  request: UpdatePropertyProjectRequest
): Promise<PropertySnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/project`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update property project: ${response.status}`);
  }

  return (await response.json()) as PropertySnapshot;
}

export async function updatePropertyAmenities(
  propertyId: string,
  request: UpdatePropertyAmenitiesRequest
): Promise<PropertySnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/amenities`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update property amenities: ${response.status}`);
  }

  return (await response.json()) as PropertySnapshot;
}

export async function getProperty(propertyId: string): Promise<PropertySnapshot | null> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoPropertyById(propertyId);
    }

    return (await response.json()) as PropertySnapshot;
  } catch {
    return demoPropertyById(propertyId);
  }
}

export async function getPropertyImages(propertyId: string): Promise<PropertyImageGalleryResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoPropertyImageGallery(propertyId);
    }

    return (await response.json()) as PropertyImageGalleryResponse;
  } catch {
    return demoPropertyImageGallery(propertyId);
  }
}

export async function getPropertyAiAssets(propertyId: string): Promise<PropertyAiAssets> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoPropertyAiAssets(propertyId);
    }

    return (await response.json()) as PropertyAiAssets;
  } catch {
    return demoPropertyAiAssets(propertyId);
  }
}

export async function addPropertyImage(
  propertyId: string,
  request: AddPropertyImageRequest
): Promise<PropertyImageSnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to add property image: ${response.status}`);
  }

  return (await response.json()) as PropertyImageSnapshot;
}

export async function createPropertyImageUploadUrl(
  propertyId: string,
  request: CreatePropertyImageUploadRequest
): Promise<CreatePropertyImageUploadResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/upload-url`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create property image upload URL: ${response.status}`);
  }

  return (await response.json()) as CreatePropertyImageUploadResponse;
}

export async function confirmPropertyImageUpload(
  propertyId: string,
  request: ConfirmPropertyImageUploadRequest
): Promise<PropertyImageSnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/confirm-upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to confirm property image upload: ${response.status}`);
  }

  return (await response.json()) as PropertyImageSnapshot;
}

export async function generatePropertySocialPostDrafts(
  propertyId: string,
  request: GeneratePropertySocialPostsRequest
): Promise<GeneratePropertySocialPostsResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/drafts`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to generate property social post drafts: ${response.status}`);
  }

  return (await response.json()) as GeneratePropertySocialPostsResponse;
}

export async function recordPropertySocialPostPublication(
  propertyId: string,
  request: RecordPropertySocialPostPublicationRequest
): Promise<RecordPropertySocialPostPublicationResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/publications`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to record property social post publication: ${response.status}`);
  }

  return (await response.json()) as RecordPropertySocialPostPublicationResponse;
}

export async function savePropertySocialPostDraft(
  propertyId: string,
  request: SavePropertySocialPostDraftRequest
): Promise<SavePropertySocialPostDraftResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/draft-overrides`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to save property social post draft: ${response.status}`);
  }

  return (await response.json()) as SavePropertySocialPostDraftResponse;
}

export async function listPropertySocialPostPublications(
  propertyId: string
): Promise<PropertySocialPostPublicationListResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/publications`, {
      headers: demoHeaders,
      next: { revalidate: 10 }
    });

    if (!response.ok) {
      return { items: [], propertyId, total: 0 };
    }

    return (await response.json()) as PropertySocialPostPublicationListResponse;
  } catch {
    return { items: [], propertyId, total: 0 };
  }
}

export async function recordPropertySocialPostReview(
  propertyId: string,
  request: RecordPropertySocialPostReviewRequest
): Promise<RecordPropertySocialPostReviewResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/reviews`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to record property social post review: ${response.status}`);
  }

  return (await response.json()) as RecordPropertySocialPostReviewResponse;
}

export async function listPropertySocialPostReviews(
  propertyId: string
): Promise<PropertySocialPostReviewListResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/reviews`, {
      headers: demoHeaders,
      next: { revalidate: 10 }
    });

    if (!response.ok) {
      return { items: [], propertyId, total: 0 };
    }

    return (await response.json()) as PropertySocialPostReviewListResponse;
  } catch {
    return { items: [], propertyId, total: 0 };
  }
}

export async function reviewPropertyImageAnalysisAsset(
  propertyId: string,
  assetId: string,
  request: ReviewAiAssetRequest
): Promise<PropertyImageAnalysisResult> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets/image-analysis/${assetId}/review`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to review image analysis asset: ${response.status}`);
  }

  return (await response.json()) as PropertyImageAnalysisResult;
}

export async function updatePropertyImageAnalysisAsset(
  propertyId: string,
  assetId: string,
  request: UpdatePropertyImageAnalysisRequest
): Promise<PropertyImageAnalysisResult> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets/image-analysis/${assetId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update image analysis asset: ${response.status}`);
  }

  return (await response.json()) as PropertyImageAnalysisResult;
}

export async function reviewPropertyDescriptionAsset(
  propertyId: string,
  assetId: string,
  request: ReviewAiAssetRequest
): Promise<GeneratedPropertyDescription> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets/descriptions/${assetId}/review`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to review description asset: ${response.status}`);
  }

  return (await response.json()) as GeneratedPropertyDescription;
}

export async function updatePropertyDescriptionAsset(
  propertyId: string,
  assetId: string,
  request: UpdateGeneratedPropertyDescriptionRequest
): Promise<GeneratedPropertyDescription> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets/descriptions/${assetId}`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update description asset: ${response.status}`);
  }

  return (await response.json()) as GeneratedPropertyDescription;
}

export async function applyPropertyDescriptionAsset(propertyId: string, assetId: string): Promise<PropertySnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets/descriptions/${assetId}/apply`, {
    method: "POST",
    headers: demoHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to apply description asset: ${response.status}`);
  }

  return (await response.json()) as PropertySnapshot;
}

export async function applyPropertyImageAnalysisAsset(propertyId: string, assetId: string): Promise<PropertySnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets/image-analysis/${assetId}/apply`, {
    method: "POST",
    headers: demoHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to apply image analysis asset: ${response.status}`);
  }

  return (await response.json()) as PropertySnapshot;
}

export async function runListingAssistant(
  propertyId: string,
  request: RunListingAssistantRequest
): Promise<RunListingAssistantResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assistant`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to run listing assistant: ${response.status}`);
  }

  return (await response.json()) as RunListingAssistantResponse;
}

export async function listSavedPropertySearches(): Promise<SavedPropertySearchListResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/saved-searches`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoSavedPropertySearchListResponse();
    }

    return (await response.json()) as SavedPropertySearchListResponse;
  } catch {
    return demoSavedPropertySearchListResponse();
  }
}

export async function listSavedSearchOpportunities(): Promise<SavedSearchOpportunitiesResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/saved-searches/opportunities?limit=12&minScore=35`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoSavedSearchOpportunitiesResponse();
    }

    return (await response.json()) as SavedSearchOpportunitiesResponse;
  } catch {
    return demoSavedSearchOpportunitiesResponse();
  }
}

export async function getSavedSearchAlertAnalytics(): Promise<SavedSearchAlertAnalyticsResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/properties/saved-searches/alerts/analytics`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoSavedSearchAlertAnalyticsResponse();
    }

    return (await response.json()) as SavedSearchAlertAnalyticsResponse;
  } catch {
    return demoSavedSearchAlertAnalyticsResponse();
  }
}

export async function listKnowledgeDocuments(request: { limit?: number } = { limit: 24 }): Promise<KnowledgeDocumentListResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/knowledge-documents${toQueryString(request)}`, {
      headers: demoHeaders,
      next: { revalidate: 20 }
    });

    if (!response.ok) {
      return demoKnowledgeDocumentListResponse();
    }

    return (await response.json()) as KnowledgeDocumentListResponse;
  } catch {
    return demoKnowledgeDocumentListResponse();
  }
}

export async function searchKnowledgeChunks(
  request: KnowledgeChunkSearchRequest
): Promise<KnowledgeChunkSearchResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/knowledge-documents/chunks/search${toQueryString(request)}`, {
      headers: demoHeaders,
      next: { revalidate: 10 }
    });

    if (!response.ok) {
      return demoKnowledgeChunkSearchResponse(request);
    }

    return (await response.json()) as KnowledgeChunkSearchResponse;
  } catch {
    return demoKnowledgeChunkSearchResponse(request);
  }
}

export async function askAiChat(request: AiChatRequest): Promise<AiChatResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/chat`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...demoHeaders
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      return demoAiChatResponse(request);
    }

    return (await response.json()) as AiChatResponse;
  } catch {
    return demoAiChatResponse(request);
  }
}

export async function embedKnowledgeChunks(
  request: Omit<KnowledgeChunkEmbeddingJobPayload, "tenantId" | "requestedByUserId">
): Promise<BackgroundJobSnapshot> {
  const response = await fetch(`${apiBaseUrl}/knowledge-documents/chunks/embed`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to enqueue knowledge chunk embedding: ${response.status}`);
  }

  return (await response.json()) as BackgroundJobSnapshot;
}

export async function createKnowledgeDocument(request: CreateKnowledgeDocumentRequest): Promise<KnowledgeDocumentSnapshot> {
  const response = await fetch(`${apiBaseUrl}/knowledge-documents`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create knowledge document: ${response.status}`);
  }

  return (await response.json()) as KnowledgeDocumentSnapshot;
}

export async function ingestKnowledgeDocument(documentId: string): Promise<BackgroundJobSnapshot> {
  const response = await fetch(`${apiBaseUrl}/knowledge-documents/${documentId}/ingest`, {
    method: "POST",
    headers: demoHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to ingest knowledge document: ${response.status}`);
  }

  return (await response.json()) as BackgroundJobSnapshot;
}

export async function enqueuePropertyImport(
  request: Omit<PropertyImportJobPayload, "tenantId" | "requestedByUserId">
): Promise<BackgroundJobSnapshot> {
  const response = await fetch(`${apiBaseUrl}/jobs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify({
      name: "properties.import",
      payload: request
    })
  });

  if (!response.ok) {
    throw new Error(`Failed to enqueue property import: ${response.status}`);
  }

  return (await response.json()) as BackgroundJobSnapshot;
}

export async function createPropertyImportUploadUrl(
  request: CreatePropertyImportUploadRequest
): Promise<CreatePropertyImportUploadResponse> {
  const response = await fetch(`${apiBaseUrl}/jobs/imports/upload-url`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create property import upload URL: ${response.status}`);
  }

  return (await response.json()) as CreatePropertyImportUploadResponse;
}

export async function getCurrentTenant(): Promise<TenantSnapshot> {
  try {
    const response = await fetch(`${apiBaseUrl}/tenants/current`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoTenantSnapshot();
    }

    return (await response.json()) as TenantSnapshot;
  } catch {
    return demoTenantSnapshot();
  }
}

export async function getTenantUsage(): Promise<TenantUsageResponse> {
  try {
    const response = await fetch(`${apiBaseUrl}/tenants/current/usage`, {
      headers: demoHeaders,
      next: { revalidate: 30 }
    });

    if (!response.ok) {
      return demoTenantUsageResponse();
    }

    return (await response.json()) as TenantUsageResponse;
  } catch {
    return demoTenantUsageResponse();
  }
}

export async function updateTenantSettings(request: UpdateTenantSettingsRequest): Promise<TenantSnapshot> {
  const response = await fetch(`${apiBaseUrl}/tenants/current/settings`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to update tenant settings: ${response.status}`);
  }

  return (await response.json()) as TenantSnapshot;
}

function toQueryString(request: object) {
  const params = new URLSearchParams();

  Object.entries(request).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const query = params.toString();

  return query ? `?${query}` : "";
}

function demoTenantDashboardMetrics(): TenantDashboardMetrics {
  const totalLeads = 38;
  const wonLeads = 11;
  const lostLeads = 7;
  const conciergeLeads = 12;
  const savedSearchLeads = 9;

  return {
    attributedLeads: 24,
    availableProperties: 12,
    averageSearchLatencyMs: 118,
    conciergeAwaitingInputSessions: 8,
    conciergeFeedbackByRating: [
      { bucket: "positive", count: 18 },
      { bucket: "neutral", count: 5 },
      { bucket: "negative", count: 2 }
    ],
    conciergeFeedbackCount: 25,
    conciergeLeadConversionRate: conciergeLeads / 31,
    conciergeLeads,
    conciergePositiveFeedbackRate: 0.72,
    conciergeRecommendedSessions: 23,
    conciergeRecommendationsByArea: [
      { bucket: "Wongamat", count: 11 },
      { bucket: "Jomtien", count: 7 },
      { bucket: "Pratumnak", count: 5 }
    ],
    conciergeSessions: 31,
    conciergeTrainingDatasetRows: 128,
    conciergeTrainingLabelCoverageRate: 0.64,
    conversionRate: wonLeads / Math.max(1, wonLeads + lostLeads),
    generatedAt: new Date().toISOString(),
    leadQualityAffectedByAgent: [
      { bucket: "agent-demo-1", count: 4 },
      { bucket: "agent-demo-2", count: 2 }
    ],
    leadQualityAffectedBySource: [
      { bucket: "website", count: 5 },
      { bucket: "ai-concierge", count: 3 }
    ],
    leadQualityAffectedLeads: 7,
    leadQualityByIssue: [
      { bucket: "missing-follow-up", count: 4 },
      { bucket: "unassigned", count: 3 }
    ],
    leadQualityHealthScore: 84,
    leadQualityIssueCount: 9,
    leadSlaAverageFirstResponseHours: 2.6,
    leadSlaBreachRate: 0.08,
    leadSlaBreachedBySource: [
      { bucket: "website", count: 2 },
      { bucket: "saved-search", count: 1 }
    ],
    leadSlaHealthScore: 91,
    leadSlaOverdueFollowUps: 3,
    leadSlaResponseBreached: 2,
    leadSlaResponseDueSoon: 5,
    leadSlaUnassignedBreached: 1,
    leadsByAttributedSearchSource: [
      { bucket: "ai-search", count: 13 },
      { bucket: "saved-search", count: 9 }
    ],
    leadsBySource: [
      { bucket: "website", count: 14 },
      { bucket: "ai-concierge", count: conciergeLeads },
      { bucket: "saved-search", count: savedSearchLeads }
    ],
    leadsByStatus: [
      { bucket: "new", count: 8 },
      { bucket: "qualified", count: 12 },
      { bucket: "won", count: wonLeads },
      { bucket: "lost", count: lostLeads }
    ],
    lostLeads,
    newLeads: 8,
    savedSearchConvertedSearches: 6,
    savedSearchFollowUpCompletionRate: 0.58,
    savedSearchLeadConversionRate: savedSearchLeads / 19,
    savedSearchLeadCoverageRate: 0.42,
    savedSearchLeadCoveredMatches: 14,
    savedSearchLeads,
    savedSearchMatchedProperties: 33,
    savedSearchOpenOpportunities: 7,
    savedSearches: 19,
    searchesBySource: [
      { bucket: "ai-search", count: 86 },
      { bucket: "catalog", count: 44 },
      { bucket: "concierge", count: 31 }
    ],
    searchToLeadConversionRate: 0.18,
    security: {
      blockedAiActions: 2,
      blockedAiActionsByName: [{ bucket: "property.image.delete", count: 2 }],
      imageDeletePreviews: 5,
      imageRemovals: 1,
      rejectedJobEnqueues: 1,
      rejectedJobsByName: [{ bucket: "concierge.model.train", count: 1 }]
    },
    tenantId: demoHeaders["x-tenant-id"],
    topLeadSearchQueries: [
      { bucket: "quiet condo near Terminal 21", count: 6 },
      { bucket: "rent in Pattaya under 30k", count: 4 }
    ],
    topSearchQueries: [
      { bucket: "Terminal 21 walkable", count: 18 },
      { bucket: "Wongamat family condo", count: 12 },
      { bucket: "Pattaya yield above 6%", count: 9 }
    ],
    totalLeads,
    totalProperties: 18,
    totalSearches: 161,
    unassignedLeads: 5,
    wonLeads
  };
}

function demoTenantSnapshot(): TenantSnapshot {
  return {
    id: demoHeaders["x-tenant-id"],
    name: "Demo Thailand Realty",
    slug: "demo-thailand-realty",
    status: "active",
    primaryMarket: "pattaya",
    customDomain: "demo.propertyflow.local",
    domainStatus: "pending-verification",
    subscriptionPlan: "growth",
    limits: {
      properties: 250,
      agents: 12,
      aiCreditsMonthly: 20_000,
      publicApiRequestsMonthly: 50_000
    },
    branding: {
      displayName: "Demo Thailand Realty",
      primaryColor: "#0f766e"
    },
    createdAt: "2026-01-12T09:00:00.000Z",
    updatedAt: new Date().toISOString()
  };
}

function demoTenantUsageResponse(): TenantUsageResponse {
  const tenant = demoTenantSnapshot();
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const usage = [
    ["properties", 18, tenant.limits.properties],
    ["agents", 4, tenant.limits.agents],
    ["aiCreditsMonthly", 8240, tenant.limits.aiCreditsMonthly],
    ["publicApiRequestsMonthly", 1280, tenant.limits.publicApiRequestsMonthly]
  ] as const;

  return {
    tenantId: tenant.id,
    subscriptionPlan: tenant.subscriptionPlan,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    generatedAt: now.toISOString(),
    items: usage.map(([key, used, limit]) => ({
      key,
      used,
      limit,
      remaining: Math.max(limit - used, 0),
      utilizationRate: limit > 0 ? Math.round((used / limit) * 10_000) / 100 : 0
    }))
  };
}

function demoLeadListResponse(request: ListLeadsRequest = {}): LeadListResponse {
  const leads = filterDemoLeads(demoLeadSnapshots(), request);
  const offset = request.offset ?? 0;
  const limit = request.limit ?? leads.length;

  return {
    items: leads.slice(offset, offset + limit),
    total: leads.length
  };
}

function demoLeadSnapshots(): LeadSnapshot[] {
  const now = new Date();
  const leads: LeadSnapshot[] = [
    {
      id: "lead-demo-001",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-wongamat-sea-view",
      source: "ai-concierge",
      status: "new",
      contactName: "Irina Volkova",
      contactEmail: "irina@example.com",
      contactPhone: "+66 81 234 1201",
      message: "Relocating to Pattaya with family, quiet area, school access, budget around THB 3.5M.",
      preferredLocale: "ru",
      attributionSearchQuery: "family move to Pattaya quiet area 3.5M",
      attributionSearchSource: "ai",
      priority: "high",
      nextFollowUpAt: addHours(now, 2),
      createdAt: addHours(now, -1),
      updatedAt: addHours(now, -1)
    },
    {
      id: "lead-demo-002",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-terminal-21-rental-loft",
      source: "saved-search",
      status: "contacted",
      contactName: "Anton Lebedev",
      contactEmail: "anton@example.com",
      message: "Needs 6 month rental near Terminal 21, walkable to beach, remote-work internet.",
      preferredLocale: "ru",
      assignedAgentId: "agent-demo-1",
      attributionSearchQuery: "rent Terminal 21 good internet under 30k",
      attributionSearchSource: "indexed",
      priority: "medium",
      nextFollowUpAt: addHours(now, -3),
      createdAt: addHours(now, -30),
      updatedAt: addHours(now, -8)
    },
    {
      id: "lead-demo-003",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-pratumnak-investment",
      source: "website",
      status: "qualified",
      contactName: "Maya Chen",
      contactEmail: "maya@example.com",
      contactPhone: "+852 5551 0912",
      message: "Looking for rental yield above 6%, prefers liquid Pattaya condo, cash buyer.",
      preferredLocale: "en",
      assignedAgentId: "agent-demo-2",
      attributionSearchQuery: "Pattaya rental yield above 6%",
      attributionSearchSource: "ai",
      priority: "high",
      nextFollowUpAt: addHours(now, 18),
      createdAt: addHours(now, -52),
      updatedAt: addHours(now, -7)
    },
    {
      id: "lead-demo-004",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-jomtien-family-corner",
      source: "ai-chat",
      status: "new",
      contactName: "Sergey Orlov",
      contactEmail: "sergey@example.com",
      message: "Compares Jomtien and Wongamat for winter living with two children.",
      preferredLocale: "ru",
      attributionSearchQuery: "winter living family Jomtien Wongamat",
      attributionSearchSource: "ai",
      priority: "medium",
      nextFollowUpAt: addHours(now, 6),
      createdAt: addHours(now, -5),
      updatedAt: addHours(now, -5)
    },
    {
      id: "lead-demo-005",
      tenantId: demoHeaders["x-tenant-id"],
      propertyId: "property-phuket-rawai-pool-villa",
      source: "agent",
      status: "won",
      contactName: "Daniel Moore",
      contactEmail: "daniel@example.com",
      contactPhone: "+44 7700 900321",
      message: "Family villa in Rawai with pool and parking. Contract signed.",
      preferredLocale: "en",
      assignedAgentId: "agent-demo-1",
      priority: "low",
      createdAt: addHours(now, -130),
      updatedAt: addHours(now, -12)
    },
    {
      id: "lead-demo-006",
      tenantId: demoHeaders["x-tenant-id"],
      source: "public-api",
      status: "lost",
      contactName: "Narin S.",
      contactPhone: "+66 82 456 0190",
      message: "Wanted a very short lease under current market range.",
      preferredLocale: "th",
      assignedAgentId: "agent-demo-2",
      priority: "low",
      createdAt: addHours(now, -96),
      updatedAt: addHours(now, -60)
    }
  ];

  return leads.sort((left, right) => sortDemoLeads(left, right, "follow-up-asc"));
}

function demoLeadQueueSummaryResponse(filters: ListLeadsRequest): LeadQueueSummaryResponse {
  const leads = filterDemoLeads(demoLeadSnapshots(), { ...filters, limit: undefined, offset: undefined });
  const openStatuses = new Set(["new", "contacted", "qualified"]);
  const now = new Date();
  const soon = new Date(now.getTime() + 1000 * 60 * 60 * 24);

  return {
    total: leads.length,
    open: leads.filter((lead) => openStatuses.has(lead.status)).length,
    assigned: leads.filter((lead) => lead.assignedAgentId).length,
    unassigned: leads.filter((lead) => !lead.assignedAgentId).length,
    overdueFollowUps: leads.filter((lead) => lead.nextFollowUpAt && new Date(lead.nextFollowUpAt) < now).length,
    dueSoonFollowUps: leads.filter((lead) => {
      if (!lead.nextFollowUpAt) {
        return false;
      }

      const followUpAt = new Date(lead.nextFollowUpAt);

      return followUpAt >= now && followUpAt <= soon;
    }).length,
    highPriority: leads.filter((lead) => lead.priority === "high").length,
    byStatus: countBy(leads, (lead) => lead.status),
    byPriority: countBy(leads, (lead) => lead.priority ?? "none"),
    bySource: countBy(leads, (lead) => lead.source),
    filters,
    generatedAt: new Date().toISOString()
  };
}

function demoLeadById(leadId: string) {
  return demoLeadListResponse().items.find((lead) => lead.id === leadId) ?? null;
}

function filterDemoLeads(leads: LeadSnapshot[], request: ListLeadsRequest) {
  return leads
    .filter((lead) => !request.status || lead.status === request.status)
    .filter((lead) => !request.source || lead.source === request.source)
    .filter((lead) => !request.priority || lead.priority === request.priority)
    .filter((lead) => !request.propertyId || lead.propertyId === request.propertyId)
    .filter((lead) => !request.missingProperty || !lead.propertyId)
    .filter((lead) => !request.assignedAgentId || lead.assignedAgentId === request.assignedAgentId)
    .filter((lead) => !request.unassigned || !lead.assignedAgentId)
    .filter((lead) => matchesDemoLeadQuery(lead, request.query))
    .filter(
      (lead) =>
        !request.attributionSocialPostTrackingSlug ||
        lead.attributionSocialPostTrackingSlug === request.attributionSocialPostTrackingSlug
    )
    .sort((left, right) => sortDemoLeads(left, right, request.sort ?? "follow-up-asc"));
}

function matchesDemoLeadQuery(lead: LeadSnapshot, query?: string) {
  const normalizedQuery = query?.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const digits = normalizedQuery.replace(/\D/g, "");
  const haystack = [
    lead.contactName,
    lead.contactEmail,
    lead.contactPhone,
    lead.message,
    lead.propertyId,
    lead.attributionSearchQuery,
    lead.attributionSearchSource,
    lead.attributionSocialPostCampaign,
    lead.attributionSocialPostTrackingSlug
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const phoneDigits = (lead.contactPhone ?? "").replace(/\D/g, "");

  return haystack.includes(normalizedQuery) || (digits.length > 0 && phoneDigits.includes(digits));
}

function sortDemoLeads(left: LeadSnapshot, right: LeadSnapshot, sort: NonNullable<ListLeadsRequest["sort"]>) {
  if (sort === "created-asc") {
    return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
  }

  if (sort === "created-desc") {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }

  if (sort === "priority-desc") {
    const priorityRank = { high: 1, medium: 2, low: 3 };
    const leftRank = left.priority ? priorityRank[left.priority] : 4;
    const rightRank = right.priority ? priorityRank[right.priority] : 4;

    return leftRank - rightRank || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
  }

  const leftFollowUp = left.nextFollowUpAt ? new Date(left.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER;
  const rightFollowUp = right.nextFollowUpAt ? new Date(right.nextFollowUpAt).getTime() : Number.MAX_SAFE_INTEGER;

  return leftFollowUp - rightFollowUp || new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
}

function demoLeadAgents(): TenantUserSnapshot[] {
  return [
    {
      id: "agent-demo-1",
      tenantId: demoHeaders["x-tenant-id"],
      name: "Agent 1",
      email: "agent1@propertyflow.test",
      role: "agent",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "agent-demo-2",
      tenantId: demoHeaders["x-tenant-id"],
      name: "Agent 2",
      email: "agent2@propertyflow.test",
      role: "agent",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "manager-demo-1",
      tenantId: demoHeaders["x-tenant-id"],
      name: "Manager",
      email: "manager@propertyflow.test",
      role: "manager",
      status: "active",
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ];
}

function demoLeadTimelineResponse(leadId: string): LeadTimelineResponse {
  const lead = demoLeadById(leadId);
  const now = new Date();

  if (!lead) {
    return { leadId, items: [], total: 0 };
  }

  const items: LeadTimelineResponse["items"] = [
    {
      id: `${leadId}-timeline-created`,
      tenantId: lead.tenantId,
      leadId,
      type: "created",
      title: `Lead created from ${lead.source}`,
      actorUserId: lead.assignedAgentId,
      actorUserRole: lead.assignedAgentId ? "agent" : undefined,
      payload: { source: lead.source, contactName: lead.contactName },
      createdAt: lead.createdAt
    },
    {
      id: `${leadId}-timeline-follow-up`,
      tenantId: lead.tenantId,
      leadId,
      type: "follow-up-updated",
      title: lead.nextFollowUpAt ? "Follow-up scheduled" : "Follow-up needs scheduling",
      actorUserId: lead.assignedAgentId ?? demoHeaders["x-user-id"],
      actorUserRole: lead.assignedAgentId ? "agent" : "manager",
      payload: { nextFollowUpAt: lead.nextFollowUpAt ?? null, priority: lead.priority ?? "none" },
      createdAt: lead.updatedAt
    },
    {
      id: `${leadId}-timeline-review`,
      tenantId: lead.tenantId,
      leadId,
      type: "note",
      title: "AI context reviewed",
      actorUserId: demoHeaders["x-user-id"],
      actorUserRole: "manager",
      payload: { note: "Review intent, budget, property fit, and preferred channel before outreach." },
      createdAt: addHours(now, -2)
    }
  ];

  return {
    leadId,
    items,
    total: items.length
  };
}

function demoLeadNotesResponse(leadId: string): LeadNotesResponse {
  const lead = demoLeadById(leadId);

  if (!lead) {
    return { leadId, items: [], total: 0 };
  }

  const items: LeadNotesResponse["items"] = [
    {
      id: `${leadId}-note-1`,
      tenantId: lead.tenantId,
      leadId,
      note: "Confirm intent, timeline, and whether the client wants video tour or in-person viewing.",
      createdByUserId: demoHeaders["x-user-id"],
      createdByUserRole: "manager",
      createdAt: addHours(new Date(), -3)
    }
  ];

  return {
    leadId,
    items,
    total: items.length
  };
}

function countBy<T>(items: T[], getBucket: (item: T) => string) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const bucket = getBucket(item);
    counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
  });

  return [...counts.entries()].map(([bucket, count]) => ({ bucket, count }));
}

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000).toISOString();
}

function demoPropertySearchResponse(filters: PropertySearchRequest): PropertySearchResponse {
  const now = new Date();
  const properties: PropertySnapshot[] = [
    {
      id: "property-wongamat-sea-view",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Wongamat Sea View Residence",
      description: "High-floor condo near Wongamat beach with sea view, fiber internet, pool, gym, and winter rental appeal.",
      kind: "condo",
      listingType: "sale_or_rent",
      market: "pattaya",
      status: "available",
      price: { amount: 3_500_000, currency: "THB" },
      rentalPriceMonthly: { amount: 28_000, currency: "THB" },
      monthlyRentEstimate: { amount: 30_000, currency: "THB" },
      maintenanceFeeMonthly: { amount: 2_400, currency: "THB" },
      location: { latitude: 12.9638, longitude: 100.8842 },
      address: "Wongamat Beach, Pattaya",
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 45,
      floor: 18,
      beachDistanceMeters: 240,
      amenities: ["sea-view", "pool", "gym", "fiber-internet", "security"],
      createdAt: addHours(now, -12),
      updatedAt: addHours(now, -2)
    },
    {
      id: "property-terminal-21-rental-loft",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Central Pattaya Rental Loft",
      description: "City-center rental loft for tenants who want nightlife, shopping, restaurants, and fast internet near Beach Road.",
      kind: "condo",
      listingType: "rent",
      market: "pattaya",
      status: "available",
      price: { amount: 2_100_000, currency: "THB" },
      rentalPriceMonthly: { amount: 24_000, currency: "THB" },
      monthlyRentEstimate: { amount: 24_000, currency: "THB" },
      location: { latitude: 12.9438, longitude: 100.8918 },
      address: "Central Pattaya, near Beach Road",
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 38,
      floor: 9,
      beachDistanceMeters: 620,
      amenities: ["fiber-internet", "pool", "coworking", "security"],
      createdAt: addHours(now, -22),
      updatedAt: addHours(now, -4)
    },
    {
      id: "property-pratumnak-investment",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Pratumnak Investment One-Bed",
      description: "Compact ownership case for liquidity-focused investors near cafes, baht bus routes, and beach access.",
      kind: "condo",
      listingType: "sale",
      market: "pattaya",
      status: "reserved",
      price: { amount: 4_600_000, currency: "THB" },
      monthlyRentEstimate: { amount: 34_000, currency: "THB" },
      maintenanceFeeMonthly: { amount: 2_900, currency: "THB" },
      location: { latitude: 12.9178, longitude: 100.8641 },
      address: "Pratumnak Hill, Pattaya",
      bedrooms: 1,
      bathrooms: 1,
      areaSqm: 52,
      floor: 12,
      beachDistanceMeters: 380,
      amenities: ["pool", "gym", "security"],
      createdAt: addHours(now, -44),
      updatedAt: addHours(now, -10)
    },
    {
      id: "property-jomtien-family-corner",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Jomtien Family Corner Condo",
      description: "Larger two-bedroom unit for families who need quieter surroundings, storage, and easier beach weekends.",
      kind: "condo",
      listingType: "sale",
      market: "pattaya",
      status: "draft",
      price: { amount: 4_200_000, currency: "THB" },
      monthlyRentEstimate: { amount: 27_000, currency: "THB" },
      location: { latitude: 12.8876, longitude: 100.8763 },
      address: "Jomtien Second Road, Pattaya",
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 72,
      floor: 6,
      beachDistanceMeters: 850,
      amenities: ["pool", "parking"],
      createdAt: addHours(now, -50),
      updatedAt: addHours(now, -20)
    },
    {
      id: "property-phuket-rawai-pool-villa",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Phuket Rawai Pool Villa",
      description: "Private villa in Rawai for relocation or family living with pool, parking, outdoor dining, and beach access.",
      kind: "villa",
      listingType: "sale",
      market: "phuket",
      status: "available",
      price: { amount: 12_800_000, currency: "THB" },
      monthlyRentEstimate: { amount: 95_000, currency: "THB" },
      maintenanceFeeMonthly: { amount: 8_500, currency: "THB" },
      location: { latitude: 7.7794, longitude: 98.3253 },
      address: "Rawai, Phuket",
      bedrooms: 3,
      bathrooms: 3,
      areaSqm: 210,
      beachDistanceMeters: 1200,
      amenities: ["private-pool", "parking", "outdoor-dining", "security"],
      createdAt: addHours(now, -72),
      updatedAt: addHours(now, -18)
    },
    {
      id: "property-na-jomtien-beachfront-lease",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Na Jomtien Beachfront Lease",
      description: "Large beachfront rental with calmer resort feel, direct beach access, balcony, and room for longer family stays.",
      kind: "condo",
      listingType: "rent",
      market: "pattaya",
      status: "rented",
      price: { amount: 6_900_000, currency: "THB" },
      rentalPriceMonthly: { amount: 52_000, currency: "THB" },
      monthlyRentEstimate: { amount: 52_000, currency: "THB" },
      location: { latitude: 12.833, longitude: 100.908 },
      address: "Na Jomtien beachfront",
      bedrooms: 2,
      bathrooms: 2,
      areaSqm: 86,
      floor: 14,
      beachDistanceMeters: 70,
      amenities: ["beachfront", "pool", "gym", "security"],
      createdAt: addHours(now, -90),
      updatedAt: addHours(now, -26)
    }
  ];

  const filteredProperties = properties.filter((property) => {
    if (filters.projectLink === "linked" && !property.project) {
      return false;
    }

    if (filters.projectLink === "missing" && property.project) {
      return false;
    }

    if (filters.projectId && property.project?.id !== filters.projectId) {
      return false;
    }

    if (filters.query && !matchesDemoSmartQuery(property, filters.query)) {
      return false;
    }

    return true;
  });
  const sortedProperties = sortDemoProperties(filteredProperties, filters);
  const offset = filters.offset ?? 0;
  const items =
    filters.limit !== undefined ? sortedProperties.slice(offset, offset + filters.limit) : sortedProperties.slice(offset);

  return {
    filters,
    items,
    total: filteredProperties.length
  };
}

function sortDemoProperties(properties: PropertySnapshot[], filters: PropertySearchRequest) {
  return [...properties].sort((left, right) => {
    if (filters.sort === "price-asc") {
      return left.price.amount - right.price.amount || newestFirst(left, right);
    }

    if (filters.sort === "price-desc") {
      return right.price.amount - left.price.amount || newestFirst(left, right);
    }

    if (filters.sort === "rent-asc") {
      return demoRent(left) - demoRent(right) || newestFirst(left, right);
    }

    if (filters.sort === "yield-desc") {
      return demoGrossYield(right) - demoGrossYield(left) || newestFirst(left, right);
    }

    return newestFirst(left, right);
  });
}

function matchesDemoSmartQuery(property: PropertySnapshot, query: string) {
  const parsed = parseDemoInventoryQuery(query);

  if (parsed.bedrooms !== undefined && property.bedrooms !== parsed.bedrooms) {
    return false;
  }

  if (parsed.maxRentMonthly !== undefined && demoRent(property) > parsed.maxRentMonthly) {
    return false;
  }

  if (parsed.maxPrice !== undefined && property.price.amount > parsed.maxPrice) {
    return false;
  }

  if (parsed.requiresMissingProject && property.project) {
    return false;
  }

  const haystack = [
    property.title,
    property.description,
    property.kind,
    property.listingType,
    property.market,
    property.status,
    property.address,
    property.project?.name,
    property.project?.developer,
    ...property.amenities
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return parsed.tokens.every((token) => haystack.includes(token));
}

function parseDemoInventoryQuery(query: string) {
  const raw = query.trim().toLowerCase();
  const bedroomMatch = raw.match(/\b(\d+)\s*(?:bed|beds|bedroom|bedrooms|bd)\b/);
  const maxRentMatch = raw.match(
    /\b(?:under|below|max|up to)\s*(\d+(?:\.\d+)?)\s*(k)?\s*(?:\/?\s*month|monthly|rent|thb\/mo|k\/mo)\b/
  );
  const maxPriceMatch =
    raw.match(/\b(?:under|below|max|up to)\s*(\d+(?:\.\d+)?)\s*(m|million|mln)\b/) ??
    raw.match(/\b(?:under|below|max|up to)\s*(\d+(?:\.\d+)?)\s*(?:thb|baht|sale|price)\b/);
  const ignoredTokens = new Set([
    "a",
    "an",
    "and",
    "baht",
    "below",
    "for",
    "max",
    "month",
    "monthly",
    "price",
    "rent",
    "sale",
    "thb",
    "under",
    "up",
    "to",
    "with"
  ]);
  const tokens = raw
    .replace(/\b\d+(?:\.\d+)?\s*(?:k|m|million|mln)?\b/g, " ")
    .replace(/\b(?:bed|beds|bedroom|bedrooms|bd|month|monthly|thb\/mo|k\/mo)\b/g, " ")
    .split(/[^a-z0-9-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !ignoredTokens.has(token));

  return {
    bedrooms: bedroomMatch ? Number(bedroomMatch[1]) : undefined,
    maxPrice: maxPriceMatch ? parseDemoMoneyAmount(maxPriceMatch[1], maxPriceMatch[2]) : undefined,
    maxRentMonthly: maxRentMatch ? parseDemoMoneyAmount(maxRentMatch[1], maxRentMatch[2]) : undefined,
    requiresMissingProject: /\b(?:missing project|no project|without project|unlinked)\b/.test(raw),
    tokens
  };
}

function parseDemoMoneyAmount(value: string, suffix?: string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return undefined;
  }

  if (suffix === "m" || suffix === "million" || suffix === "mln") {
    return amount * 1_000_000;
  }

  if (suffix === "k") {
    return amount * 1_000;
  }

  return amount;
}

function demoRent(property: PropertySnapshot) {
  return property.rentalPriceMonthly?.amount ?? property.monthlyRentEstimate?.amount ?? Number.MAX_SAFE_INTEGER;
}

function demoGrossYield(property: PropertySnapshot) {
  const rent = property.rentalPriceMonthly ?? property.monthlyRentEstimate;

  if (!rent || property.price.amount <= 0) {
    return 0;
  }

  return (rent.amount * 12) / property.price.amount;
}

function newestFirst(left: PropertySnapshot, right: PropertySnapshot) {
  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function demoPropertyById(propertyId: string) {
  return demoPropertySearchResponse({ limit: 30 }).items.find((property) => property.id === propertyId) ?? null;
}

function demoPropertyImageGallery(propertyId: string): PropertyImageGalleryResponse {
  const property = demoPropertyById(propertyId);
  const now = new Date().toISOString();

  if (!property) {
    return { images: [], propertyId };
  }

  const imageUrls = demoPropertyImageUrls(property);

  return {
    images: imageUrls.map((imageUrl, index) => ({
      caption: index === 0 ? `${property.title} cover` : `${property.title} photo ${index + 1}`,
      createdAt: now,
      id: `${propertyId}-image-${index + 1}`,
      imageUrl,
      position: index,
      propertyId,
      tenantId: demoHeaders["x-tenant-id"]
    })),
    propertyId
  };
}

function demoPropertyImageUrls(property: PropertySnapshot) {
  if (property.kind === "villa") {
    return [
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1300&q=85",
      "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=85"
    ];
  }

  if (property.address?.toLowerCase().includes("terminal")) {
    return [
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1300&q=85",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=900&q=85"
    ];
  }

  if (property.bedrooms >= 2) {
    return [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1300&q=85",
      "https://images.unsplash.com/photo-1560185007-c5ca9d2c014d?auto=format&fit=crop&w=900&q=85",
      "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=900&q=85"
    ];
  }

  return [
    "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1300&q=85",
    "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=900&q=85",
    "https://images.unsplash.com/photo-1560448075-bb485b067938?auto=format&fit=crop&w=900&q=85"
  ];
}

function demoPropertyAiAssets(propertyId: string): PropertyAiAssets {
  return {
    descriptions: [],
    imageAnalysis: [],
    propertyId
  };
}

function demoKnowledgeDocumentListResponse(): KnowledgeDocumentListResponse {
  const now = new Date();
  const items: KnowledgeDocumentSnapshot[] = [
    {
      id: "knowledge-wongamat-relocation",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Wongamat relocation briefing",
      body: "Wongamat is calmer than Central Pattaya, with strong beach access, family-friendly condos, and good demand from long-stay tenants.",
      locale: "en",
      kind: "relocation",
      tags: ["pattaya", "wongamat", "family"],
      createdAt: addHours(now, -96),
      updatedAt: addHours(now, -12)
    },
    {
      id: "knowledge-pattaya-yield",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Pattaya rental yield notes",
      body: "Yield estimates should compare monthly rent, occupancy assumptions, maintenance fees, agency fees, and building liquidity.",
      locale: "en",
      kind: "investment",
      tags: ["pattaya", "yield", "rental"],
      createdAt: addHours(now, -72),
      updatedAt: addHours(now, -8)
    },
    {
      id: "knowledge-chanote-basics",
      tenantId: demoHeaders["x-tenant-id"],
      title: "Chanote document checklist",
      body: "Before publishing ownership-sensitive claims, confirm title deed type, owner name, plot area, encumbrance notes, and coordinate consistency.",
      locale: "en",
      kind: "legal",
      tags: ["chanote", "ownership", "documents"],
      createdAt: addHours(now, -48),
      updatedAt: addHours(now, -4)
    }
  ];

  return {
    items,
    total: items.length
  };
}

function demoKnowledgeChunkSearchResponse(request: KnowledgeChunkSearchRequest): KnowledgeChunkSearchResponse {
  const documents = demoKnowledgeDocumentListResponse().items.filter((document) => {
    if (request.locale && document.locale !== request.locale) {
      return false;
    }

    if (request.kind && document.kind !== request.kind) {
      return false;
    }

    return true;
  });
  const terms = request.query
    .toLowerCase()
    .split(/[^a-zа-я0-9-]+/i)
    .filter((term) => term.length >= 3);
  const now = new Date().toISOString();
  const items = documents
    .map((document, index) => {
      const haystack = `${document.title} ${document.body} ${document.tags.join(" ")}`.toLowerCase();
      const lexicalHits = terms.filter((term) => haystack.includes(term)).length;

      return {
        id: `${document.id}-chunk-1`,
        tenantId: document.tenantId,
        documentId: document.id,
        chunkIndex: 0,
        title: document.title,
        content: document.body,
        locale: document.locale,
        kind: document.kind,
        tags: document.tags,
        tokenEstimate: Math.max(24, Math.round(document.body.length / 4)),
        score: lexicalHits * 3 + Math.max(0, 3 - index),
        embeddingStatus: index === 0 ? "embedded" : "pending",
        createdAt: document.createdAt,
        updatedAt: now
      } satisfies KnowledgeChunkSearchResponse["items"][number];
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, request.limit ?? 5);

  return {
    generatedAt: now,
    items,
    retrieval: items.some((item) => item.embeddingStatus === "embedded") ? "hybrid-chunks-v1" : "lexical-chunks-v1",
    total: items.length
  };
}

function demoAiChatResponse(request: AiChatRequest): AiChatResponse {
  const knowledge = demoKnowledgeChunkSearchResponse({
    limit: 3,
    locale: request.locale,
    query: request.message
  });
  const knowledgeLine = knowledge.items.length
    ? knowledge.items.map((item) => `${item.title}: ${item.content}`).join(" ")
    : "No approved knowledge chunks matched this question yet.";

  return {
    id: `demo-chat-${Date.now()}`,
    message: request.message,
    answer: `Based on tenant knowledge, I would answer with: ${knowledgeLine}`,
    matchedPropertyIds: [],
    citations: knowledge.items.map((item) => ({
      documentId: item.documentId,
      label: `${item.title} (${item.kind}, chunk ${item.chunkIndex + 1}, score ${item.score})`,
      source: "knowledge",
      title: item.title
    })),
    suggestedActions: ["review-citations", "add-source-document", "run-retrieval-preview"],
    createdAt: new Date().toISOString()
  };
}

function demoSavedPropertySearchListResponse(): SavedPropertySearchListResponse {
  const now = new Date();
  const items: SavedPropertySearchListResponse["items"] = [
    {
      id: "saved-search-family-pattaya",
      tenantId: demoHeaders["x-tenant-id"],
      userId: demoHeaders["x-user-id"],
      title: "Family move to quiet Pattaya",
      naturalLanguageQuery: "Moving to Pattaya with family, quiet area, budget 3.5M THB",
      locale: "en",
      purpose: "relocation",
      filters: {
        listingType: "sale",
        market: "pattaya",
        maxPriceThb: 3_800_000,
        minBedrooms: 1,
        requiredAmenities: ["pool", "security"],
        sort: "ai-fit"
      },
      matchCount: 4,
      notificationsEnabled: true,
      createdAt: addHours(now, -74),
      updatedAt: addHours(now, -6)
    },
    {
      id: "saved-search-terminal-rent",
      tenantId: demoHeaders["x-tenant-id"],
      userId: demoHeaders["x-user-id"],
      title: "Terminal 21 rental under 30k",
      naturalLanguageQuery: "Need to rent near Terminal 21, beach access, good internet, under 30k THB/month",
      locale: "en",
      purpose: "living",
      filters: {
        listingType: "rent",
        market: "pattaya",
        maxMonthlyRentThb: 30_000,
        requiredAmenities: ["fiber-internet"],
        sort: "beach-asc"
      },
      matchCount: 3,
      notificationsEnabled: true,
      createdAt: addHours(now, -50),
      updatedAt: addHours(now, -2)
    },
    {
      id: "saved-search-yield-pattaya",
      tenantId: demoHeaders["x-tenant-id"],
      userId: "agent-demo-2",
      title: "Pattaya yield above 6%",
      naturalLanguageQuery: "Investment condo in Pattaya with yield above 6%",
      locale: "en",
      purpose: "investment",
      filters: {
        listingType: "sale",
        market: "pattaya",
        maxPriceThb: 5_000_000,
        sort: "yield-desc"
      },
      matchCount: 5,
      notificationsEnabled: false,
      createdAt: addHours(now, -120),
      updatedAt: addHours(now, -18)
    },
    {
      id: "saved-search-rawai-family",
      tenantId: demoHeaders["x-tenant-id"],
      userId: demoHeaders["x-user-id"],
      title: "Rawai villa relocation",
      naturalLanguageQuery: "Family villa in Rawai with pool and parking",
      locale: "en",
      purpose: "family",
      filters: {
        listingType: "sale",
        market: "phuket",
        minBedrooms: 3,
        requiredAmenities: ["private-pool", "parking"],
        sort: "ai-fit"
      },
      matchCount: 2,
      notificationsEnabled: true,
      createdAt: addHours(now, -160),
      updatedAt: addHours(now, -28)
    }
  ];

  return {
    items,
    total: items.length
  };
}

function demoSavedSearchOpportunitiesResponse(): SavedSearchOpportunitiesResponse {
  const now = new Date();
  const savedSearches = demoSavedPropertySearchListResponse().items;
  const properties = demoPropertySearchResponse({ limit: 30 }).items;
  const items: SavedSearchOpportunitiesResponse["items"] = [
    {
      savedSearch: savedSearches[0],
      currentMatchCount: 4,
      leadCount: 0,
      opportunityScore: 92,
      reason: "High-fit family relocation search has fresh matches but no lead yet.",
      topRecommendation: {
        property: properties[0],
        score: 87,
        reasons: ["Wongamat is quieter than central Pattaya.", "Budget fit is close enough for negotiation."],
        tradeoffs: ["One bedroom may be tight for larger families."]
      }
    },
    {
      savedSearch: savedSearches[1],
      currentMatchCount: 3,
      leadCount: 1,
      opportunityScore: 78,
      reason: "Rental intent is active and one follow-up is overdue.",
      latestLeadAt: addHours(now, -26),
      topRecommendation: {
        property: properties[1],
        score: 82,
        reasons: ["Monthly rent is below budget.", "Fiber internet and central location match the request."],
        tradeoffs: ["Central Pattaya is busier and less quiet."]
      }
    },
    {
      savedSearch: savedSearches[2],
      currentMatchCount: 5,
      leadCount: 2,
      opportunityScore: 71,
      reason: "Investment search has enough matches for a curated comparison email.",
      latestLeadAt: addHours(now, -42),
      topRecommendation: {
        property: properties[2],
        score: 79,
        reasons: ["Compact unit has stronger liquidity.", "Rent estimate supports a yield story."],
        tradeoffs: ["Reserved status needs availability confirmation."]
      }
    }
  ];

  return {
    generatedAt: new Date().toISOString(),
    items,
    summary: {
      averageOpportunityScore: Math.round(items.reduce((sum, item) => sum + item.opportunityScore, 0) / items.length),
      hotOpportunities: items.filter((item) => item.opportunityScore >= 80).length,
      openOpportunities: items.length,
      unconvertedOpportunities: items.filter((item) => item.leadCount === 0).length
    },
    total: items.length
  };
}

function demoSavedSearchAlertAnalyticsResponse(): SavedSearchAlertAnalyticsResponse {
  const lastRun = {
    id: "alert-run-demo-001",
    tenantId: demoHeaders["x-tenant-id"],
    requestedByUserId: demoHeaders["x-user-id"],
    scope: "tenant" as const,
    dryRun: false,
    status: "completed" as const,
    totalAlerts: 3,
    totalCandidates: 12,
    items: [
      { savedSearchId: "saved-search-family-pattaya", title: "Family move to quiet Pattaya", currentMatchCount: 4 },
      { savedSearchId: "saved-search-terminal-rent", title: "Terminal 21 rental under 30k", currentMatchCount: 3 }
    ],
    createdAt: addHours(new Date(), -8)
  };

  return {
    averageCandidatesPerRun: 4,
    completedRuns: 6,
    enabledAlerts: 3,
    failedRuns: 0,
    generatedAt: new Date().toISOString(),
    lastRun,
    recentRuns: 6,
    totalCandidates: 24,
    totalSavedSearches: demoSavedPropertySearchListResponse().total
  };
}

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
  ReorderPropertyImagesRequest,
  SavePropertySocialPostDraftRequest,
  SavePropertySocialPostDraftResponse,
  AiChatRequest,
  AiChatResponse,
  AmenitySuggestionRequest,
  AmenitySuggestionResponse,
  CreateKnowledgeDocumentUploadRequest,
  CreateKnowledgeDocumentUploadResponse,
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
  ConfirmPropertyImageDeleteRequest,
  ConfirmPropertyImageUploadRequest,
  CreatePropertyImageUploadRequest,
  CreatePropertyImageUploadResponse,
  GeneratedPropertyDescription,
  PropertyAiAssets,
  PropertyImageDeletePreviewResponse,
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
  const response = await fetch(`${apiBaseUrl}/analytics/dashboard`, {
    headers: demoHeaders,
    next: { revalidate: 30 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load tenant dashboard metrics: ${response.status}`);
  }

  return (await response.json()) as TenantDashboardMetrics;
}

export async function listBackgroundJobs(
  request: { limit?: number; states?: BackgroundJobState[] } = { limit: 12 },
  options: { revalidateSeconds?: number | false } = {}
): Promise<BackgroundJobMonitorResponse> {
  const response = await fetch(`${apiBaseUrl}/jobs${toQueryString(request)}`, {
    headers: demoHeaders,
    ...(options.revalidateSeconds === false
      ? { cache: "no-store" as const }
      : { next: { revalidate: options.revalidateSeconds ?? 5 } })
  });

  if (!response.ok) {
    throw new Error(`Failed to load background jobs: ${response.status}`);
  }

  return (await response.json()) as BackgroundJobMonitorResponse;
}

export async function getBackgroundJob(
  jobId: string,
  options: { revalidateSeconds?: number | false } = {}
): Promise<BackgroundJobMonitorItem | null> {
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
    throw new Error(`Failed to load background job: ${response.status}`);
  }

  return (await response.json()) as BackgroundJobMonitorItem;
}

export async function searchPropertyProjects(
  request: PropertyProjectSearchRequest = { limit: 8 },
  options: { revalidateSeconds?: number | false } = {}
): Promise<PropertyProjectSearchResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/projects${toQueryString(request)}`, {
    headers: demoHeaders,
    ...(options.revalidateSeconds === false
      ? { cache: "no-store" as const }
      : { next: { revalidate: options.revalidateSeconds ?? 10 } })
  });

  if (!response.ok) {
    throw new Error(`Failed to search property projects: ${response.status}`);
  }

  return (await response.json()) as PropertyProjectSearchResponse;
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
  const response = await fetch(`${apiBaseUrl}/properties/amenities${toQueryString(request)}`, {
    headers: demoHeaders,
    ...(options.revalidateSeconds === false
      ? { cache: "no-store" as const }
      : { next: { revalidate: options.revalidateSeconds ?? 10 } })
  });

  if (!response.ok) {
    throw new Error(`Failed to search amenities: ${response.status}`);
  }

  return (await response.json()) as AmenitySuggestionResponse;
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
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load property: ${response.status}`);
  }

  return (await response.json()) as PropertySnapshot;
}

export async function getPropertyImages(propertyId: string): Promise<PropertyImageGalleryResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load property images: ${response.status}`);
  }

  return (await response.json()) as PropertyImageGalleryResponse;
}

export async function getPropertyAiAssets(propertyId: string): Promise<PropertyAiAssets> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/ai-assets`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load property AI assets: ${response.status}`);
  }

  return (await response.json()) as PropertyAiAssets;
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

export async function previewPropertyImageDelete(
  propertyId: string,
  imageId: string
): Promise<PropertyImageDeletePreviewResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/${imageId}/delete-preview`, {
    method: "POST",
    headers: demoHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to preview property image delete: ${response.status}`);
  }

  return (await response.json()) as PropertyImageDeletePreviewResponse;
}

export async function deletePropertyImage(
  propertyId: string,
  imageId: string,
  request: ConfirmPropertyImageDeleteRequest
): Promise<PropertyImageSnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/${imageId}`, {
    method: "DELETE",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to delete property image: ${response.status}`);
  }

  return (await response.json()) as PropertyImageSnapshot;
}

export async function restorePropertyImage(propertyId: string, imageId: string): Promise<PropertyImageSnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/${imageId}/restore`, {
    method: "POST",
    headers: demoHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to restore property image: ${response.status}`);
  }

  return (await response.json()) as PropertyImageSnapshot;
}

export async function makePropertyImageCover(propertyId: string, imageId: string): Promise<PropertyImageSnapshot> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/${imageId}/cover`, {
    method: "PATCH",
    headers: demoHeaders
  });

  if (!response.ok) {
    throw new Error(`Failed to make property image cover: ${response.status}`);
  }

  return (await response.json()) as PropertyImageSnapshot;
}

export async function reorderPropertyImages(
  propertyId: string,
  request: ReorderPropertyImagesRequest
): Promise<PropertyImageGalleryResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/images/reorder`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to reorder property images: ${response.status}`);
  }

  return (await response.json()) as PropertyImageGalleryResponse;
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
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/publications`, {
    headers: demoHeaders,
    next: { revalidate: 10 }
  });

  if (!response.ok) {
    throw new Error(`Failed to list property social post publications: ${response.status}`);
  }

  return (await response.json()) as PropertySocialPostPublicationListResponse;
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
  const response = await fetch(`${apiBaseUrl}/properties/${propertyId}/social-posts/reviews`, {
    headers: demoHeaders,
    next: { revalidate: 10 }
  });

  if (!response.ok) {
    throw new Error(`Failed to list property social post reviews: ${response.status}`);
  }

  return (await response.json()) as PropertySocialPostReviewListResponse;
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
  const response = await fetch(`${apiBaseUrl}/properties/saved-searches`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load saved property searches: ${response.status}`);
  }

  return (await response.json()) as SavedPropertySearchListResponse;
}

export async function listSavedSearchOpportunities(): Promise<SavedSearchOpportunitiesResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/saved-searches/opportunities?limit=12&minScore=35`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load saved search opportunities: ${response.status}`);
  }

  return (await response.json()) as SavedSearchOpportunitiesResponse;
}

export async function getSavedSearchAlertAnalytics(): Promise<SavedSearchAlertAnalyticsResponse> {
  const response = await fetch(`${apiBaseUrl}/properties/saved-searches/alerts/analytics`, {
    headers: demoHeaders,
    next: { revalidate: 30 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load saved search alert analytics: ${response.status}`);
  }

  return (await response.json()) as SavedSearchAlertAnalyticsResponse;
}

export async function listKnowledgeDocuments(request: { limit?: number } = { limit: 24 }): Promise<KnowledgeDocumentListResponse> {
  const response = await fetch(`${apiBaseUrl}/knowledge-documents${toQueryString(request)}`, {
    headers: demoHeaders,
    next: { revalidate: 20 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load knowledge documents: ${response.status}`);
  }

  return (await response.json()) as KnowledgeDocumentListResponse;
}

export async function searchKnowledgeChunks(
  request: KnowledgeChunkSearchRequest
): Promise<KnowledgeChunkSearchResponse> {
  const response = await fetch(`${apiBaseUrl}/knowledge-documents/chunks/search${toQueryString(request)}`, {
    headers: demoHeaders,
    next: { revalidate: 10 }
  });

  if (!response.ok) {
    throw new Error(`Failed to search knowledge chunks: ${response.status}`);
  }

  return (await response.json()) as KnowledgeChunkSearchResponse;
}

export async function askAiChat(request: AiChatRequest): Promise<AiChatResponse> {
  const response = await fetch(`${apiBaseUrl}/chat`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to ask AI chat: ${response.status}`);
  }

  return (await response.json()) as AiChatResponse;
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

export async function createKnowledgeDocumentUploadUrl(
  request: CreateKnowledgeDocumentUploadRequest
): Promise<CreateKnowledgeDocumentUploadResponse> {
  const response = await fetch(`${apiBaseUrl}/knowledge-documents/upload-url`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...demoHeaders
    },
    body: JSON.stringify(request)
  });

  if (!response.ok) {
    throw new Error(`Failed to create knowledge document upload URL: ${response.status}`);
  }

  return (await response.json()) as CreateKnowledgeDocumentUploadResponse;
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
  const response = await fetch(`${apiBaseUrl}/tenants/current`, {
    headers: demoHeaders,
    next: { revalidate: 30 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load current tenant: ${response.status}`);
  }

  return (await response.json()) as TenantSnapshot;
}

export async function getTenantUsage(): Promise<TenantUsageResponse> {
  const response = await fetch(`${apiBaseUrl}/tenants/current/usage`, {
    headers: demoHeaders,
    next: { revalidate: 30 }
  });

  if (!response.ok) {
    throw new Error(`Failed to load tenant usage: ${response.status}`);
  }

  return (await response.json()) as TenantUsageResponse;
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

"use server";

import type {
  RecordPropertySocialPostPublicationRequest,
  RecordPropertySocialPostPublicationResponse,
  RecordPropertySocialPostReviewRequest,
  RecordPropertySocialPostReviewResponse,
  SavePropertySocialPostDraftRequest,
  SavePropertySocialPostDraftResponse
} from "@propertyflow/contracts";
import {
  recordPropertySocialPostPublication,
  recordPropertySocialPostReview,
  savePropertySocialPostDraft
} from "@shared/api/agency-client";

export function recordPropertySocialPostPublicationAction(
  propertyId: string,
  request: RecordPropertySocialPostPublicationRequest
): Promise<RecordPropertySocialPostPublicationResponse> {
  return recordPropertySocialPostPublication(propertyId, request);
}

export function recordPropertySocialPostReviewAction(
  propertyId: string,
  request: RecordPropertySocialPostReviewRequest
): Promise<RecordPropertySocialPostReviewResponse> {
  return recordPropertySocialPostReview(propertyId, request);
}

export function savePropertySocialPostDraftAction(
  propertyId: string,
  request: SavePropertySocialPostDraftRequest
): Promise<SavePropertySocialPostDraftResponse> {
  return savePropertySocialPostDraft(propertyId, request);
}

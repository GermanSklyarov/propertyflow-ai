import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { AuditAction, AuditEventSnapshot, ListAuditEventsRequest } from "@propertyflow/contracts";

const auditActions = [
  "chat.asked",
  "concierge.advised",
  "concierge.feedback_submitted",
  "concierge.lead_created",
  "concierge.message_added",
  "concierge.model_training_requested",
  "concierge.session_created",
  "concierge.training_dataset_viewed",
  "knowledge.document_created",
  "knowledge.document_embedding_requested",
  "knowledge.document_ingestion_requested",
  "pricing.model_training_requested",
  "property.created",
  "property.ai_assistant",
  "property.ai_description_applied",
  "property.ai_image_analysis_applied",
  "property.ai_asset_reviewed",
  "property.ai_search",
  "property.compared",
  "property.image_added",
  "property.image_delete_previewed",
  "property.image_removed",
  "property.image_restored",
  "property.published",
  "property.price_recommendation_feedback",
  "property.price_training_dataset_viewed",
  "property.price_recommended",
  "property.price_updated",
  "property.status_changed",
  "saved_search.created",
  "saved_search.deleted",
  "saved_search.matches_viewed",
  "saved_search.viewed",
  "tenant.current_viewed",
  "lead.created",
  "lead.assigned",
  "job.enqueued",
  "job.enqueue_rejected"
] as const satisfies readonly AuditAction[];

const resourceTypes = [
  "property",
  "tenant",
  "search",
  "comparison",
  "lead",
  "job",
  "knowledge"
] as const satisfies readonly AuditEventSnapshot["resourceType"][];

export class ListAuditEventsDto implements ListAuditEventsRequest {
  @ApiProperty({ required: false, enum: auditActions })
  @IsOptional()
  @IsIn(auditActions)
  action?: AuditAction;

  @ApiProperty({ required: false, enum: resourceTypes })
  @IsOptional()
  @IsIn(resourceTypes)
  resourceType?: AuditEventSnapshot["resourceType"];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export function toListAuditEventsQuery(query: ListAuditEventsDto): ListAuditEventsRequest {
  return {
    action: query.action,
    resourceType: query.resourceType,
    resourceId: query.resourceId,
    userId: query.userId,
    limit: toOptionalNumber(query.limit)
  };
}

function toOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}

import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type {
  AiAgentActionName,
  BackgroundJobSnapshot,
  RequestUser,
  RunListingAssistantRequest,
  RunListingAssistantResponse
} from "@propertyflow/contracts";
import { JobQueueService } from "../../../jobs/application/job-queue.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";
import { AiAgentActionPolicyService } from "./ai-agent-action-policy.service.js";

@Injectable()
export class ListingAssistantService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(JobQueueService) private readonly jobs: JobQueueService,
    @Inject(AiAgentActionPolicyService) private readonly actionPolicy: AiAgentActionPolicyService
  ) {}

  async run(
    tenantId: string,
    propertyId: string,
    request: RunListingAssistantRequest,
    user: RequestUser
  ): Promise<RunListingAssistantResponse> {
    const property = await this.properties.findById(tenantId, propertyId);

    if (!property) {
      throw new NotFoundException("Property not found");
    }

    const jobs: BackgroundJobSnapshot[] = [];
    const shouldGenerateDescriptions = request.generateDescriptions ?? true;
    const shouldAnalyzeImages = request.analyzeImages ?? Boolean(request.imageUrls?.length);
    const plannedActions = this.plannedActions(request, shouldGenerateDescriptions, shouldAnalyzeImages);
    const policy = this.actionPolicy.evaluate(user, plannedActions);
    const allowedActions = new Set(
      policy.filter((item) => item.decision === "allowed").map((item) => item.action)
    );

    if (shouldGenerateDescriptions && allowedActions.has("property.ai_description.generate")) {
      jobs.push(
        await this.jobs.enqueue("properties.ai_description.generate", {
          tenantId,
          requestedByUserId: user.id,
          propertyId,
          locales: request.locales?.length ? request.locales : ["en", "ru"]
        })
      );
    }

    if (shouldAnalyzeImages && request.imageUrls?.length && allowedActions.has("property.images.analyze")) {
      jobs.push(
        await this.jobs.enqueue("properties.images.analyze", {
          tenantId,
          requestedByUserId: user.id,
          propertyId,
          imageUrls: request.imageUrls
        })
      );
    }

    return {
      propertyId,
      jobs,
      actionPolicy: policy
    };
  }

  private plannedActions(
    request: RunListingAssistantRequest,
    shouldGenerateDescriptions: boolean,
    shouldAnalyzeImages: boolean
  ): AiAgentActionName[] {
    const actions: AiAgentActionName[] = [...(request.requestedActions ?? [])];

    if (shouldGenerateDescriptions) {
      actions.push("property.ai_description.generate");
    }

    if (shouldAnalyzeImages && request.imageUrls?.length) {
      actions.push("property.images.analyze");
    }

    return actions;
  }
}

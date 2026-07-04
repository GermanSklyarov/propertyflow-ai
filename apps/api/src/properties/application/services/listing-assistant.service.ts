import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { BackgroundJobSnapshot, RequestUser, RunListingAssistantRequest, RunListingAssistantResponse } from "@propertyflow/contracts";
import { JobQueueService } from "../../../jobs/application/job-queue.service.js";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../domain/property.repository.js";

@Injectable()
export class ListingAssistantService {
  constructor(
    @Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository,
    @Inject(JobQueueService) private readonly jobs: JobQueueService
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

    if (shouldGenerateDescriptions) {
      jobs.push(
        await this.jobs.enqueue("properties.ai_description.generate", {
          tenantId,
          requestedByUserId: user.id,
          propertyId,
          locales: request.locales?.length ? request.locales : ["en", "ru"]
        })
      );
    }

    if (shouldAnalyzeImages && request.imageUrls?.length) {
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
      jobs
    };
  }
}

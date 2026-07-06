import { Controller, Get, Inject, NotFoundException, Param, Query, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PropertySearchResponse, PublicApiKeySnapshot } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { PROPERTY_REPOSITORY, type PropertyRepository } from "../../../properties/domain/property.repository.js";
import { SearchPropertiesDto, toPropertySearchRequest } from "../../../properties/presentation/rest/search-properties.dto.js";
import { PublicApiKey } from "./public-api-key.decorator.js";
import { PublicApiKeyGuard } from "./public-api-key.guard.js";

@ApiTags("public-properties")
@ApiHeader({ name: "x-api-key", required: true })
@Controller("public/v1/properties")
@UseGuards(PublicApiKeyGuard)
export class PublicPropertiesController {
  constructor(@Inject(PROPERTY_REPOSITORY) private readonly properties: PropertyRepository) {}

  @Get()
  @ApiOperation({ summary: "Search public properties for the API key tenant" })
  async search(
    @PublicApiKey() apiKey: PublicApiKeySnapshot,
    @Query() query: SearchPropertiesDto
  ): Promise<PropertySearchResponse> {
    const filters = toPropertySearchRequest(query);
    const items = (await this.properties.search(apiKey.tenantId, filters)).filter(
      (property) => property.status === "available"
    );

    return {
      items,
      total: items.length,
      filters
    };
  }

  @Get(":propertyId")
  @ApiOperation({ summary: "Get a public property by id for the API key tenant" })
  async get(
    @PublicApiKey() apiKey: PublicApiKeySnapshot,
    @Param("propertyId") propertyId: string
  ): Promise<PropertySnapshot> {
    const property = await this.properties.findById(apiKey.tenantId, propertyId);

    if (!property || property.status !== "available") {
      throw new NotFoundException("Property not found");
    }

    return property;
  }
}

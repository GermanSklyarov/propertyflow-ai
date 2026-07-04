import { Body, Controller, Post, UnauthorizedException, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { LeadSnapshot, PublicApiKeySnapshot } from "@propertyflow/contracts";
import { LeadService } from "../../../leads/application/lead.service.js";
import { CreateLeadDto } from "../../../leads/presentation/rest/create-lead.dto.js";
import { PublicApiKey } from "./public-api-key.decorator.js";
import { PublicApiKeyGuard } from "./public-api-key.guard.js";

@ApiTags("public-leads")
@ApiHeader({ name: "x-api-key", required: true })
@Controller("public/v1/leads")
@UseGuards(PublicApiKeyGuard)
export class PublicLeadsController {
  constructor(private readonly leads: LeadService) {}

  @Post()
  @ApiOperation({ summary: "Create a lead for the API key tenant" })
  create(@PublicApiKey() apiKey: PublicApiKeySnapshot, @Body() payload: CreateLeadDto): Promise<LeadSnapshot> {
    if (!apiKey.scopes.includes("leads:write")) {
      throw new UnauthorizedException("API key is missing leads:write scope");
    }

    return this.leads.create(apiKey.tenantId, {
      ...payload,
      source: "public-api"
    });
  }
}


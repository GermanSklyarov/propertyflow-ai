import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { AiAdvisorSummary, NaturalLanguagePropertySearchResponse, PropertySearchResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { CreatePropertyCommand } from "../../application/commands/create-property.command.js";
import { GetPropertyQuery } from "../../application/queries/get-property.query.js";
import { ListPropertiesQuery } from "../../application/queries/list-properties.query.js";
import { AiPropertyAdvisorService } from "../../application/services/ai-property-advisor.service.js";
import { NaturalLanguagePropertySearchService } from "../../application/services/natural-language-property-search.service.js";
import { CreatePropertyDto } from "./create-property.dto.js";
import { NaturalLanguageSearchDto } from "./natural-language-search.dto.js";
import { SearchPropertiesDto } from "./search-properties.dto.js";

@Controller("properties")
export class PropertiesController {
  constructor(
    @Inject(CommandBus)
    private readonly commandBus: CommandBus,
    @Inject(QueryBus)
    private readonly queryBus: QueryBus,
    @Inject(AiPropertyAdvisorService)
    private readonly advisor: AiPropertyAdvisorService,
    @Inject(NaturalLanguagePropertySearchService)
    private readonly naturalLanguageSearch: NaturalLanguagePropertySearchService
  ) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() payload: CreatePropertyDto): Promise<PropertySnapshot> {
    return this.commandBus.execute(new CreatePropertyCommand(tenantId, payload));
  }

  @Get()
  list(@TenantId() tenantId: string, @Query() query: SearchPropertiesDto): Promise<PropertySearchResponse> {
    return this.queryBus.execute(new ListPropertiesQuery(tenantId, query.toSearchRequest()));
  }

  @Post("ai-search")
  aiSearch(
    @TenantId() tenantId: string,
    @Body() payload: NaturalLanguageSearchDto
  ): Promise<NaturalLanguagePropertySearchResponse> {
    return this.naturalLanguageSearch.search(tenantId, payload);
  }

  @Get(":propertyId/advisor")
  advisorSummary(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<AiAdvisorSummary> {
    return this.advisor.summarize(tenantId, propertyId);
  }

  @Get(":propertyId")
  get(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<PropertySnapshot> {
    return this.queryBus.execute(new GetPropertyQuery(tenantId, propertyId));
  }
}

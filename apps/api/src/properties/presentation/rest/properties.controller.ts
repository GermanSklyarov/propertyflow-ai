import { Body, Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { CommandBus, QueryBus } from "@nestjs/cqrs";
import type { PropertyListResponse } from "@propertyflow/contracts";
import type { PropertySnapshot } from "@propertyflow/domain";
import { TenantId } from "../../../shared/presentation/tenant-id.decorator.js";
import { CreatePropertyCommand } from "../../application/commands/create-property.command.js";
import { GetPropertyQuery } from "../../application/queries/get-property.query.js";
import { ListPropertiesQuery } from "../../application/queries/list-properties.query.js";
import { CreatePropertyDto } from "./create-property.dto.js";

@Controller("properties")
export class PropertiesController {
  constructor(
    @Inject(CommandBus)
    private readonly commandBus: CommandBus,
    @Inject(QueryBus)
    private readonly queryBus: QueryBus
  ) {}

  @Post()
  create(@TenantId() tenantId: string, @Body() payload: CreatePropertyDto): Promise<PropertySnapshot> {
    return this.commandBus.execute(new CreatePropertyCommand(tenantId, payload));
  }

  @Get()
  list(@TenantId() tenantId: string): Promise<PropertyListResponse> {
    return this.queryBus.execute(new ListPropertiesQuery(tenantId));
  }

  @Get(":propertyId")
  get(@TenantId() tenantId: string, @Param("propertyId") propertyId: string): Promise<PropertySnapshot> {
    return this.queryBus.execute(new GetPropertyQuery(tenantId, propertyId));
  }
}

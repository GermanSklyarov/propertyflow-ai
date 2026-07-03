import type { CreatePropertyRequest } from "@propertyflow/contracts";

export class CreatePropertyCommand {
  constructor(
    public readonly tenantId: string,
    public readonly payload: CreatePropertyRequest
  ) {}
}


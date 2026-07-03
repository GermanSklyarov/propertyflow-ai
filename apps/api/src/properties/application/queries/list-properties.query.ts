import type { PropertySearchRequest } from "@propertyflow/contracts";

export class ListPropertiesQuery {
  constructor(
    public readonly tenantId: string,
    public readonly filters: PropertySearchRequest
  ) {}
}

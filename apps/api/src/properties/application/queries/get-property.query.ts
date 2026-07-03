export class GetPropertyQuery {
  constructor(
    public readonly tenantId: string,
    public readonly propertyId: string
  ) {}
}


import { Injectable } from "@nestjs/common";
import type { PropertySnapshot } from "@propertyflow/domain";
import type { PropertyRepository } from "../domain/property.repository.js";

@Injectable()
export class InMemoryPropertyRepository implements PropertyRepository {
  private readonly properties = new Map<string, PropertySnapshot>();

  async save(property: PropertySnapshot): Promise<PropertySnapshot> {
    this.properties.set(this.key(property.tenantId, property.id), property);
    return property;
  }

  async findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null> {
    return this.properties.get(this.key(tenantId, propertyId)) ?? null;
  }

  async list(tenantId: string): Promise<PropertySnapshot[]> {
    return [...this.properties.values()].filter((property) => property.tenantId === tenantId);
  }

  private key(tenantId: string, propertyId: string): string {
    return `${tenantId}:${propertyId}`;
  }
}


import type { Money, PropertySnapshot, PropertyStatus } from "@propertyflow/domain";
import type {
  CreatePropertyProjectRequest,
  PropertyPriceHistoryPoint,
  PropertyProjectSuggestion,
  PropertyProjectSearchRequest,
  PropertyProjectSearchResponse,
  PropertySearchResponse,
  PropertySearchRequest,
  UpdatePropertyProjectRecordRequest,
  UpdatePropertyProjectRequest
} from "@propertyflow/contracts";

export const PROPERTY_REPOSITORY = Symbol("PROPERTY_REPOSITORY");

export interface PropertyRepository {
  save(property: PropertySnapshot): Promise<PropertySnapshot>;
  findById(tenantId: string, propertyId: string): Promise<PropertySnapshot | null>;
  updateListingText(
    tenantId: string,
    propertyId: string,
    title: string,
    description: string
  ): Promise<PropertySnapshot | null>;
  updateAmenities(tenantId: string, propertyId: string, amenities: string[]): Promise<PropertySnapshot | null>;
  updatePrice(tenantId: string, propertyId: string, price: Money): Promise<PropertySnapshot | null>;
  updateProject(
    tenantId: string,
    propertyId: string,
    project: UpdatePropertyProjectRequest["project"]
  ): Promise<PropertySnapshot | null>;
  updateStatus(tenantId: string, propertyId: string, status: PropertyStatus): Promise<PropertySnapshot | null>;
  list(tenantId: string): Promise<PropertySnapshot[]>;
  search(tenantId: string, filters: PropertySearchRequest): Promise<PropertySnapshot[]>;
  searchPage(tenantId: string, filters: PropertySearchRequest): Promise<PropertySearchResponse>;
  createProject(tenantId: string, project: CreatePropertyProjectRequest): Promise<PropertyProjectSuggestion>;
  findProjectById(tenantId: string, projectId: string): Promise<PropertyProjectSuggestion | null>;
  searchProjects(tenantId: string, filters: PropertyProjectSearchRequest): Promise<PropertyProjectSearchResponse>;
  updateProjectRecord(
    tenantId: string,
    projectId: string,
    project: UpdatePropertyProjectRecordRequest
  ): Promise<PropertyProjectSuggestion | null>;
  addPriceHistoryPoint(
    tenantId: string,
    propertyId: string,
    price: Money,
    source: PropertyPriceHistoryPoint["source"],
    effectiveDate: string
  ): Promise<PropertyPriceHistoryPoint>;
  listPriceHistory(tenantId: string, propertyId: string): Promise<PropertyPriceHistoryPoint[]>;
}

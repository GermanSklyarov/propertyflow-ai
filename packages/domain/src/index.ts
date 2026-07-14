export type Currency = "THB" | "USD" | "EUR";

export type PropertyPurpose = "living" | "investment" | "relocation" | "family";

export type PropertyKind = "condo" | "villa" | "townhouse" | "land" | "commercial";

export type PropertyListingType = "sale" | "rent" | "sale_or_rent";

export type PropertyStatus = "draft" | "available" | "reserved" | "sold" | "rented" | "archived";

export type PropertyProjectStatus = "planned" | "under_construction" | "completed" | "paused";

export type ThailandMarket = "pattaya" | "phuket" | "bangkok" | "hua-hin" | "koh-samui";

export interface Money {
  amount: number;
  currency: Currency;
}

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

export interface PropertyProjectSnapshot {
  id: string;
  tenantId: string;
  name: string;
  market: ThailandMarket;
  status: PropertyProjectStatus;
  developer?: string;
  address?: string;
  completionYear?: number;
  location?: GeoPoint;
  amenities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PropertySnapshot {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  kind: PropertyKind;
  listingType: PropertyListingType;
  market: ThailandMarket;
  status: PropertyStatus;
  price: Money;
  rentalPriceMonthly?: Money;
  location: GeoPoint;
  address?: string;
  bedrooms: number;
  bathrooms: number;
  areaSqm: number;
  floor?: number;
  beachDistanceMeters?: number;
  monthlyRentEstimate?: Money;
  maintenanceFeeMonthly?: Money;
  amenities: string[];
  project?: PropertyProjectSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentSnapshot {
  propertyId: string;
  purchasePrice: Money;
  monthlyRent: Money;
  occupancyRate: number;
  annualCosts: Money;
}

export function calculateGrossYield(input: InvestmentSnapshot): number {
  const annualRent = input.monthlyRent.amount * 12 * input.occupancyRate;
  return annualRent / input.purchasePrice.amount;
}

export function calculateNetYield(input: InvestmentSnapshot): number {
  const annualRent = input.monthlyRent.amount * 12 * input.occupancyRate;
  return (annualRent - input.annualCosts.amount) / input.purchasePrice.amount;
}

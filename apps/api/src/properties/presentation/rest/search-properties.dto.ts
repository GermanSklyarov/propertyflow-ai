import { Transform, Type } from "class-transformer";
import { BadRequestException } from "@nestjs/common";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import type { PropertySearchRequest } from "@propertyflow/contracts";
import type { PropertyListingType, ThailandMarket } from "@propertyflow/domain";

const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const propertyListingTypes: PropertyListingType[] = ["sale", "rent", "sale_or_rent"];

export class SearchPropertiesDto implements Omit<PropertySearchRequest, "near"> {
  @IsOptional()
  @IsIn(thailandMarkets)
  market?: ThailandMarket;

  @IsOptional()
  @IsIn(propertyListingTypes)
  listingType?: PropertyListingType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceThb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceThb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMonthlyRentThb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMonthlyRentThb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBathrooms?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minAreaSqm?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBeachDistanceMeters?: number;

  @IsOptional()
  @Transform(({ value }: { value: string | string[] | undefined }) => {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    return value
      .split(",")
      .map((amenity) => amenity.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsString({ each: true })
  requiredAmenities?: string[];

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  nearLatitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  nearLongitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  radiusMeters?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  toSearchRequest(): PropertySearchRequest {
    return toPropertySearchRequest(this);
  }
}

export function toPropertySearchRequest(query: SearchPropertiesDto): PropertySearchRequest {
  const nearLatitude = toOptionalNumber(query.nearLatitude);
  const nearLongitude = toOptionalNumber(query.nearLongitude);
  const radiusMeters = toOptionalNumber(query.radiusMeters);
  const hasAnyGeoFilter =
    nearLatitude !== undefined || nearLongitude !== undefined || radiusMeters !== undefined;
  const hasCompleteGeoFilter =
    nearLatitude !== undefined && nearLongitude !== undefined && radiusMeters !== undefined;

  if (hasAnyGeoFilter && !hasCompleteGeoFilter) {
    throw new BadRequestException("nearLatitude, nearLongitude, and radiusMeters must be provided together");
  }

  const filters: PropertySearchRequest = {
    market: query.market,
    listingType: query.listingType,
    minPriceThb: toOptionalNumber(query.minPriceThb),
    maxPriceThb: toOptionalNumber(query.maxPriceThb),
    minMonthlyRentThb: toOptionalNumber(query.minMonthlyRentThb),
    maxMonthlyRentThb: toOptionalNumber(query.maxMonthlyRentThb),
    minBedrooms: toOptionalNumber(query.minBedrooms),
    minBathrooms: toOptionalNumber(query.minBathrooms),
    minAreaSqm: toOptionalNumber(query.minAreaSqm),
    maxBeachDistanceMeters: toOptionalNumber(query.maxBeachDistanceMeters),
    requiredAmenities: toOptionalStringArray(query.requiredAmenities),
    radiusMeters,
    limit: toOptionalNumber(query.limit),
    offset: toOptionalNumber(query.offset)
  };

  if (nearLatitude !== undefined && nearLongitude !== undefined && radiusMeters !== undefined) {
    filters.near = {
      latitude: nearLatitude,
      longitude: nearLongitude
    };
  }

  return filters;
}

function toOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}

function toOptionalStringArray(value: string[] | string | undefined): string[] | undefined {
  if (!value) {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value;
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

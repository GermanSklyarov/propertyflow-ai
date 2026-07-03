import { Transform, Type } from "class-transformer";
import { BadRequestException } from "@nestjs/common";
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min } from "class-validator";
import type { PropertySearchRequest } from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";

const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export class SearchPropertiesDto implements Omit<PropertySearchRequest, "near"> {
  @IsOptional()
  @IsIn(thailandMarkets)
  market?: ThailandMarket;

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

  toSearchRequest(): PropertySearchRequest {
    const hasAnyGeoFilter =
      this.nearLatitude !== undefined || this.nearLongitude !== undefined || this.radiusMeters !== undefined;
    const hasCompleteGeoFilter =
      this.nearLatitude !== undefined && this.nearLongitude !== undefined && this.radiusMeters !== undefined;

    if (hasAnyGeoFilter && !hasCompleteGeoFilter) {
      throw new BadRequestException("nearLatitude, nearLongitude, and radiusMeters must be provided together");
    }

    const filters: PropertySearchRequest = {
      market: this.market,
      minPriceThb: this.minPriceThb,
      maxPriceThb: this.maxPriceThb,
      minBedrooms: this.minBedrooms,
      minBathrooms: this.minBathrooms,
      minAreaSqm: this.minAreaSqm,
      maxBeachDistanceMeters: this.maxBeachDistanceMeters,
      requiredAmenities: this.requiredAmenities,
      radiusMeters: this.radiusMeters
    };

    if (
      this.nearLatitude !== undefined &&
      this.nearLongitude !== undefined &&
      this.radiusMeters !== undefined
    ) {
      filters.near = {
        latitude: this.nearLatitude,
        longitude: this.nearLongitude
      };
    }

    return filters;
  }
}

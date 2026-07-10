import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsNumber, IsOptional, IsString, Max, Min, MinLength, ValidateNested } from "class-validator";
import type { CreateSavedPropertySearchRequest, PropertySearchRequest } from "@propertyflow/contracts";
import type { PropertyListingType, PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const locales = ["en", "ru", "th", "zh"] as const;
const purposes: PropertyPurpose[] = ["living", "investment", "relocation", "family"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const propertyListingTypes: PropertyListingType[] = ["sale", "rent", "sale_or_rent"];

export class SavedPropertySearchFiltersDto implements PropertySearchRequest {
  @ApiProperty({ required: false, enum: thailandMarkets })
  @IsOptional()
  @IsIn(thailandMarkets)
  market?: ThailandMarket;

  @ApiProperty({ required: false, enum: propertyListingTypes })
  @IsOptional()
  @IsIn(propertyListingTypes)
  listingType?: PropertyListingType;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPriceThb?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPriceThb?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minMonthlyRentThb?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxMonthlyRentThb?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBedrooms?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minBathrooms?: number;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  minAreaSqm?: number;

  @ApiProperty({ required: false, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxBeachDistanceMeters?: number;

  @ApiProperty({ required: false, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  radiusMeters?: number;
}

export class CreateSavedPropertySearchDto implements CreateSavedPropertySearchRequest {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  title!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(3)
  naturalLanguageQuery?: string;

  @ApiProperty({ required: false, enum: locales, default: "ru" })
  @IsOptional()
  @IsIn(locales)
  locale?: CreateSavedPropertySearchRequest["locale"];

  @ApiProperty({ required: false, enum: purposes })
  @IsOptional()
  @IsIn(purposes)
  purpose?: PropertyPurpose;

  @ApiProperty({ required: false, type: SavedPropertySearchFiltersDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SavedPropertySearchFiltersDto)
  filters?: SavedPropertySearchFiltersDto;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  notificationsEnabled?: boolean;
}

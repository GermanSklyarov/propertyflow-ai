import { Type } from "class-transformer";
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import type { CreatePropertyRequest } from "@propertyflow/contracts";
import type { Currency, PropertyKind, ThailandMarket } from "@propertyflow/domain";

const currencies: Currency[] = ["THB", "USD", "EUR"];
const propertyKinds: PropertyKind[] = ["condo", "villa", "townhouse", "land", "commercial"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

class MoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(currencies)
  currency!: Currency;
}

class GeoPointDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class CreatePropertyDto implements CreatePropertyRequest {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsIn(propertyKinds)
  kind!: PropertyKind;

  @IsIn(thailandMarkets)
  market!: ThailandMarket;

  @ValidateNested()
  @Type(() => MoneyDto)
  price!: MoneyDto;

  @ValidateNested()
  @Type(() => GeoPointDto)
  location!: GeoPointDto;

  @IsOptional()
  @IsString()
  address?: string;

  @IsInt()
  @Min(0)
  bedrooms!: number;

  @IsInt()
  @Min(0)
  bathrooms!: number;

  @IsNumber()
  @Min(1)
  areaSqm!: number;

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  beachDistanceMeters?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  monthlyRentEstimate?: MoneyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  maintenanceFeeMonthly?: MoneyDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  amenities?: string[];
}


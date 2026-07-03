import { IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { NaturalLanguageSearchRequest } from "@propertyflow/contracts";
import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const locales: NaturalLanguageSearchRequest["locale"][] = ["en", "ru", "th", "zh"];
const purposes: PropertyPurpose[] = ["living", "investment", "relocation", "family"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export class NaturalLanguageSearchDto implements NaturalLanguageSearchRequest {
  @IsIn(locales)
  locale!: NaturalLanguageSearchRequest["locale"];

  @IsString()
  @MinLength(3)
  query!: string;

  @IsOptional()
  @IsIn(thailandMarkets)
  market?: ThailandMarket;

  @IsOptional()
  @IsIn(purposes)
  purpose?: PropertyPurpose;
}


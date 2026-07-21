import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import type { PublicWidgetAskRequest } from "@propertyflow/contracts";
import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const locales: PublicWidgetAskRequest["locale"][] = ["en", "ru", "th", "zh"];
const purposes: PropertyPurpose[] = ["living", "investment", "relocation", "family"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export class PublicWidgetAskDto implements PublicWidgetAskRequest {
  @IsIn(locales)
  locale!: PublicWidgetAskRequest["locale"];

  @IsString()
  @MinLength(3)
  message!: string;

  @IsOptional()
  @IsUUID()
  propertyId?: string;

  @IsOptional()
  @IsIn(thailandMarkets)
  market?: ThailandMarket;

  @IsOptional()
  @IsIn(purposes)
  purpose?: PropertyPurpose;
}

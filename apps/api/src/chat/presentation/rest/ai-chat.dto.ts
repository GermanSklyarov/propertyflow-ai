import { IsIn, IsOptional, IsString, IsUUID, MinLength } from "class-validator";
import type { AiChatRequest } from "@propertyflow/contracts";
import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const locales: AiChatRequest["locale"][] = ["en", "ru", "th", "zh"];
const purposes: PropertyPurpose[] = ["living", "investment", "relocation", "family"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

export class AiChatDto implements AiChatRequest {
  @IsIn(locales)
  locale!: AiChatRequest["locale"];

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

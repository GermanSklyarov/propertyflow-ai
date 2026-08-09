import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested
} from "class-validator";
import type { PublicWidgetAskRequest, PublicWidgetLeadRequest } from "@propertyflow/contracts";
import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const locales: PublicWidgetAskRequest["locale"][] = ["en", "ru", "th", "zh"];
const purposes: PropertyPurpose[] = ["living", "investment", "relocation", "family"];
const thailandMarkets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];

class PublicWidgetConversationListingDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  propertyId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  title!: string;
}

class PublicWidgetConversationTurnDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PublicWidgetConversationListingDto)
  recommendedListings?: PublicWidgetAskRequest["conversation"] extends Array<infer Turn>
    ? Turn extends { recommendedListings?: infer Listings }
      ? Listings
      : never
    : never;

  @IsIn(["user", "assistant"])
  role!: "user" | "assistant";

  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  text!: string;
}

export class PublicWidgetAskDto implements PublicWidgetAskRequest {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PublicWidgetConversationTurnDto)
  conversation?: PublicWidgetAskRequest["conversation"];

  @IsIn(locales)
  locale!: PublicWidgetAskRequest["locale"];

  @IsString()
  @MinLength(3)
  @MaxLength(2_000)
  message!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  sessionId?: string;

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

export class PublicWidgetLeadDto implements PublicWidgetLeadRequest {
  @IsString()
  @MinLength(2)
  contactName!: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PublicWidgetConversationTurnDto)
  conversation?: PublicWidgetLeadRequest["conversation"];

  @IsIn(locales)
  locale!: PublicWidgetLeadRequest["locale"];

  @IsOptional()
  @IsString()
  @MaxLength(2_000)
  message?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => PublicWidgetConversationListingDto)
  recommendedListings?: PublicWidgetLeadRequest["recommendedListings"];
}

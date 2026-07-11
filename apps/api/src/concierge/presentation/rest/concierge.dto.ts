import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsEmail,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";
import type {
  AddConciergeSessionMessageRequest,
  ConciergeProfile,
  ConciergeRequest,
  ConciergeModelTrainJobPayload,
  CreateLeadFromConciergeSessionRequest,
  ConciergeTrainingDatasetRequest,
  ListConciergeSessionsRequest,
  SubmitConciergeFeedbackRequest
} from "@propertyflow/contracts";
import type { PropertyListingType, PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const purposes: PropertyPurpose[] = ["investment", "living", "family", "relocation"];
const listingIntents: PropertyListingType[] = ["sale", "rent", "sale_or_rent"];

export class ConciergeProfileDto implements ConciergeProfile {
  @ApiProperty({ required: false, enum: markets })
  @IsOptional()
  @IsIn(markets)
  market?: ThailandMarket;

  @ApiProperty({ required: false, enum: listingIntents })
  @IsOptional()
  @IsIn(listingIntents)
  listingIntent?: PropertyListingType;

  @ApiProperty({ required: false, minimum: 5_000, maximum: 100_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5_000)
  @Max(100_000_000)
  budgetThb?: number;

  @ApiProperty({ required: false, minimum: 1, maximum: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  familySize?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasChildren?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  hasCar?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  remoteWork?: boolean;

  @ApiProperty({ required: false, enum: purposes })
  @IsOptional()
  @IsIn(purposes)
  purpose?: PropertyPurpose;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  prefersQuiet?: boolean;
}

export class ConciergeRequestDto implements ConciergeRequest {
  @ApiProperty({ enum: ["en", "ru"] })
  @IsIn(["en", "ru"])
  locale!: "en" | "ru";

  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty({ required: false, type: ConciergeProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConciergeProfileDto)
  profile?: ConciergeProfileDto;
}

export class AddConciergeSessionMessageDto implements AddConciergeSessionMessageRequest {
  @ApiProperty()
  @IsString()
  message!: string;

  @ApiProperty({ required: false, type: ConciergeProfileDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ConciergeProfileDto)
  profile?: ConciergeProfileDto;
}

export class ListConciergeSessionsDto implements ListConciergeSessionsRequest {
  @ApiProperty({ required: false, enum: ["awaiting-input", "recommended"] })
  @IsOptional()
  @IsIn(["awaiting-input", "recommended"])
  status?: ListConciergeSessionsRequest["status"];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreateLeadFromConciergeSessionDto implements CreateLeadFromConciergeSessionRequest {
  @ApiProperty()
  @IsString()
  @MinLength(2)
  contactName!: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  propertyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  assignedAgentId?: string;
}

export class SubmitConciergeFeedbackDto implements SubmitConciergeFeedbackRequest {
  @ApiProperty({ enum: ["positive", "neutral", "negative"] })
  @IsIn(["positive", "neutral", "negative"])
  rating!: SubmitConciergeFeedbackRequest["rating"];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  areaAccurate?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  propertyRecommendationsUseful?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  selectedPropertyId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ConciergeTrainingDatasetDto implements ConciergeTrainingDatasetRequest {
  @ApiProperty({ required: false, minimum: 1, maximum: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  limit?: number;

  @ApiProperty({ required: false, enum: ["positive", "neutral", "negative"] })
  @IsOptional()
  @IsIn(["positive", "neutral", "negative"])
  rating?: ConciergeTrainingDatasetRequest["rating"];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  convertedOnly?: boolean;
}

const conciergeTrainingAlgorithms = [
  "baseline-refresh",
  "llm-reranker",
  "learning-to-rank"
] as const satisfies readonly ConciergeModelTrainJobPayload["algorithm"][];

export class TrainConciergeModelDto {
  @ApiProperty()
  @IsString()
  modelVersion!: string;

  @ApiProperty({ enum: conciergeTrainingAlgorithms })
  @IsIn(conciergeTrainingAlgorithms)
  algorithm!: ConciergeModelTrainJobPayload["algorithm"];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

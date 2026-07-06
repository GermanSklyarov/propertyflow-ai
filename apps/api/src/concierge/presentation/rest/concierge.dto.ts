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
  CreateLeadFromConciergeSessionRequest,
  ListConciergeSessionsRequest
} from "@propertyflow/contracts";
import type { PropertyPurpose, ThailandMarket } from "@propertyflow/domain";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const purposes: PropertyPurpose[] = ["investment", "living", "family", "relocation"];

export class ConciergeProfileDto implements ConciergeProfile {
  @ApiProperty({ required: false, enum: markets })
  @IsOptional()
  @IsIn(markets)
  market?: ThailandMarket;

  @ApiProperty({ required: false, minimum: 500_000, maximum: 100_000_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500_000)
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

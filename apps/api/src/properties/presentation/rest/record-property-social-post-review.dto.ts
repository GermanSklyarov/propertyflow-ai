import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";
import type {
  PropertySocialPostChannel,
  PropertySocialPostLocale,
  PropertySocialPostReviewStatus,
  RecordPropertySocialPostReviewRequest
} from "@propertyflow/contracts";

const channels = ["line-voom", "facebook", "instagram"] as const satisfies readonly PropertySocialPostChannel[];
const locales = ["en", "ru", "th", "zh"] as const satisfies readonly PropertySocialPostLocale[];
const statuses = ["review_requested", "approved"] as const satisfies readonly PropertySocialPostReviewStatus[];

export class RecordPropertySocialPostReviewDto implements RecordPropertySocialPostReviewRequest {
  @ApiProperty({ enum: channels })
  @IsIn(channels)
  channel!: PropertySocialPostChannel;

  @ApiProperty({ enum: locales })
  @IsIn(locales)
  locale!: PropertySocialPostLocale;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({ enum: statuses })
  @IsIn(statuses)
  status!: PropertySocialPostReviewStatus;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  trackingSlug!: string;
}

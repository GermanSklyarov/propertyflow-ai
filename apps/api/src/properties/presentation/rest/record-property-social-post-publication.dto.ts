import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type {
  PropertySocialPostChannel,
  PropertySocialPostLocale,
  PropertySocialPostUtm,
  RecordPropertySocialPostPublicationRequest
} from "@propertyflow/contracts";

const channels = ["line-voom", "facebook", "instagram"] as const satisfies readonly PropertySocialPostChannel[];
const locales = ["en", "ru", "th", "zh"] as const satisfies readonly PropertySocialPostLocale[];

class PropertySocialPostUtmDto implements PropertySocialPostUtm {
  @ApiProperty()
  @IsString()
  campaign!: string;

  @ApiProperty()
  @IsString()
  content!: string;

  @ApiProperty({ enum: ["social"] })
  @IsIn(["social"])
  medium!: "social";

  @ApiProperty({ enum: channels })
  @IsIn(channels)
  source!: PropertySocialPostChannel;
}

export class RecordPropertySocialPostPublicationDto implements RecordPropertySocialPostPublicationRequest {
  @ApiProperty({ enum: channels })
  @IsIn(channels)
  channel!: PropertySocialPostChannel;

  @ApiProperty({ enum: locales })
  @IsIn(locales)
  locale!: PropertySocialPostLocale;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  publishedUrl?: string;

  @ApiProperty()
  @IsString()
  trackingSlug!: string;

  @ApiProperty({ type: PropertySocialPostUtmDto })
  @ValidateNested()
  @Type(() => PropertySocialPostUtmDto)
  utm!: PropertySocialPostUtmDto;
}

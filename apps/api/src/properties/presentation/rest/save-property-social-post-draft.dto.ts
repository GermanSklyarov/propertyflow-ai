import { ApiProperty } from "@nestjs/swagger";
import { ArrayMaxSize, IsArray, IsIn, IsString, MaxLength, MinLength } from "class-validator";
import type {
  PropertySocialPostChannel,
  PropertySocialPostLocale,
  SavePropertySocialPostDraftRequest
} from "@propertyflow/contracts";

const channels = ["line-voom", "facebook", "instagram"] as const satisfies readonly PropertySocialPostChannel[];
const locales = ["en", "ru", "th", "zh"] as const satisfies readonly PropertySocialPostLocale[];

export class SavePropertySocialPostDraftDto implements SavePropertySocialPostDraftRequest {
  @ApiProperty({ minLength: 1, maxLength: 2_000 })
  @IsString()
  @MinLength(1)
  @MaxLength(2_000)
  body!: string;

  @ApiProperty({ enum: channels })
  @IsIn(channels)
  channel!: PropertySocialPostChannel;

  @ApiProperty({ minLength: 1, maxLength: 500 })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  cta!: string;

  @ApiProperty({ isArray: true, maxItems: 20, type: String })
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  hashtags!: string[];

  @ApiProperty({ minLength: 1, maxLength: 300 })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  hook!: string;

  @ApiProperty({ enum: locales })
  @IsIn(locales)
  locale!: PropertySocialPostLocale;

  @ApiProperty({ maxLength: 240 })
  @IsString()
  @MaxLength(240)
  trackingSlug!: string;
}

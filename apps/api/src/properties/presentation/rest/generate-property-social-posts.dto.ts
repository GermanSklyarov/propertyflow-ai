import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import type {
  GeneratePropertySocialPostsRequest,
  PropertySocialPostChannel,
  PropertySocialPostLocale
} from "@propertyflow/contracts";

const channels = ["line-voom", "facebook", "instagram"] as const satisfies readonly PropertySocialPostChannel[];
const locales = ["en", "ru", "th", "zh"] as const satisfies readonly PropertySocialPostLocale[];

export class GeneratePropertySocialPostsDto implements GeneratePropertySocialPostsRequest {
  @ApiProperty({ enum: channels, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsIn(channels, { each: true })
  channels?: PropertySocialPostChannel[];

  @ApiProperty({ enum: locales, required: false })
  @IsOptional()
  @IsIn(locales)
  locale?: PropertySocialPostLocale;

  @ApiProperty({ minimum: 0, maximum: 100, required: false })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  publicPhotoCount?: number;
}

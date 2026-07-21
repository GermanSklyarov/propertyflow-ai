import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsIn, IsObject, IsOptional, IsString, IsUrl, Matches, ValidateNested } from "class-validator";
import type {
  TenantWidgetLanguage,
  TenantWidgetPersonaGender,
  TenantWidgetTone,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const widgetLanguages = ["en", "ru", "th", "zh"];
const widgetTones = ["friendly", "professional", "luxury", "concise"];

export class UpdateTenantBrandingDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  displayName?: string;

  @ApiProperty({ required: false, example: "#0f766e" })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/)
  primaryColor?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  logoUrl?: string;
}

export class UpdateTenantWidgetDto {
  @ApiProperty({ required: false, example: "Anna" })
  @IsOptional()
  @IsString()
  aiName?: string;

  @ApiProperty({
    required: false,
    example: {
      en: "Anna",
      ru: "Анна",
      th: "มาลี",
      zh: "安娜"
    }
  })
  @IsOptional()
  @IsObject()
  aiNames?: Partial<Record<TenantWidgetLanguage, string>>;

  @ApiProperty({ required: false, example: ["https://agency.example.com", "https://www.agency.example.com"], type: [String] })
  @IsOptional()
  @IsArray()
  @IsUrl({ require_tld: false, require_protocol: true }, { each: true })
  allowedOrigins?: string[];

  @ApiProperty({ required: false, example: "Hi! I'm Anna, your AI property consultant." })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @ApiProperty({ required: false, example: ["en", "ru", "th", "zh"], type: [String] })
  @IsOptional()
  @IsArray()
  @IsIn(widgetLanguages, { each: true })
  languages?: TenantWidgetLanguage[];

  @ApiProperty({
    required: false,
    example: {
      en: "feminine",
      ru: "feminine",
      th: "feminine",
      zh: "neutral"
    }
  })
  @IsOptional()
  @IsObject()
  personaGenders?: Partial<Record<TenantWidgetLanguage, TenantWidgetPersonaGender>>;

  @ApiProperty({ required: false, enum: widgetTones, example: "friendly" })
  @IsOptional()
  @IsIn(widgetTones)
  tone?: TenantWidgetTone;

  @ApiProperty({
    required: false,
    example: {
      en: "Hi! I'm Anna, your AI property consultant.",
      ru: "Привет! Я Анна, ваш AI-консультант по недвижимости."
    }
  })
  @IsOptional()
  @IsObject()
  welcomeMessages?: Partial<Record<TenantWidgetLanguage, string>>;
}

export class UpdateTenantSettingsDto implements UpdateTenantSettingsRequest {
  @ApiProperty({ required: false, enum: markets })
  @IsOptional()
  @IsIn(markets)
  primaryMarket?: ThailandMarket;

  @ApiProperty({ required: false, example: "demo.propertyflow.local" })
  @IsOptional()
  @Matches(/^[a-z0-9.-]+$/)
  customDomain?: string;

  @ApiProperty({ required: false, type: UpdateTenantBrandingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantBrandingDto)
  branding?: UpdateTenantBrandingDto;

  @ApiProperty({ required: false, type: UpdateTenantWidgetDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateTenantWidgetDto)
  widget?: UpdateTenantWidgetDto;
}

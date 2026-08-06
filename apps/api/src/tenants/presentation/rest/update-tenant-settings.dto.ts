import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsBoolean, IsEmail, IsIn, IsObject, IsOptional, IsString, IsUrl, Matches, ValidateNested } from "class-validator";
import type {
  TenantLeadQualificationField,
  TenantWidgetLanguage,
  TenantWidgetPersonaGender,
  TenantWidgetTone,
  UpdateTenantSettingsRequest
} from "@propertyflow/contracts";
import type { ThailandMarket } from "@propertyflow/domain";

const markets: ThailandMarket[] = ["pattaya", "phuket", "bangkok", "hua-hin", "koh-samui"];
const widgetLanguages = ["en", "ru", "th", "zh"];
const widgetTones = ["friendly", "professional", "luxury", "concise"];
const leadQualificationFields: TenantLeadQualificationField[] = [
  "budget",
  "preferredArea",
  "bedrooms",
  "investmentPurpose",
  "moveInDate",
  "nationality",
  "financing",
  "whatsapp",
  "email",
  "phone"
];

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

  @ApiProperty({ required: false, example: "/listings/:propertyId" })
  @IsOptional()
  @IsString()
  @Matches(/^\/(?!\/).*:propertyId.*$/)
  listingUrlTemplate?: string;

  @ApiProperty({ required: false, example: "Hi! I'm Anna, your AI property consultant." })
  @IsOptional()
  @IsString()
  welcomeMessage?: string;

  @ApiProperty({ required: false, example: ["en", "ru", "th", "zh"], type: [String] })
  @IsOptional()
  @IsArray()
  @IsIn(widgetLanguages, { each: true })
  languages?: TenantWidgetLanguage[];

  @ApiProperty({ required: false, example: ["owner@agency.example"], type: [String] })
  @IsOptional()
  @IsArray()
  @IsEmail({}, { each: true })
  leadNotificationEmails?: string[];

  @ApiProperty({ required: false, example: true })
  @IsOptional()
  @IsBoolean()
  leadNotificationsEnabled?: boolean;

  @ApiProperty({ required: false, example: "https://agency.example.com/webhooks/propertyflow-leads" })
  @IsOptional()
  @IsString()
  @Matches(/^$|^https:\/\/.+/)
  leadWebhookUrl?: string;

  @ApiProperty({ required: false, example: ["-1001234567890", "@agency_channel"], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadTelegramChatIds?: string[];

  @ApiProperty({ required: false, example: "123456:tenant-bot-token" })
  @IsOptional()
  @IsString()
  leadTelegramBotToken?: string;

  @ApiProperty({ required: false, example: ["U4af4980629..."], type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  leadLineRecipientIds?: string[];

  @ApiProperty({ required: false, example: "line-channel-access-token" })
  @IsOptional()
  @IsString()
  leadLineChannelAccessToken?: string;

  @ApiProperty({ required: false, example: "line-channel-secret" })
  @IsOptional()
  @IsString()
  leadLineChannelSecret?: string;

  @ApiProperty({ required: false, example: ["+66812345678"], type: [String] })
  @IsOptional()
  @IsArray()
  @Matches(/^\+?[1-9]\d{7,14}$/, { each: true })
  leadWhatsappRecipients?: string[];

  @ApiProperty({ required: false, example: "whatsapp-cloud-api-token" })
  @IsOptional()
  @IsString()
  leadWhatsappAccessToken?: string;

  @ApiProperty({ required: false, example: "123456789012345" })
  @IsOptional()
  @IsString()
  leadWhatsappPhoneNumberId?: string;

  @ApiProperty({ required: false, example: "v20.0" })
  @IsOptional()
  @Matches(/^v\d+\.\d+$/)
  leadWhatsappGraphApiVersion?: string;

  @ApiProperty({ required: false, enum: leadQualificationFields, isArray: true })
  @IsOptional()
  @IsArray()
  @IsIn(leadQualificationFields, { each: true })
  leadQualificationFields?: TenantLeadQualificationField[];

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

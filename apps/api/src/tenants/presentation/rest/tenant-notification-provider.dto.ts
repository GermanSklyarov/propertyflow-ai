import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsIn, IsOptional, IsString, Matches } from "class-validator";
import type {
  TenantNotificationProvider,
  TenantNotificationProviderConnectRequest,
  TenantNotificationProviderTestRequest,
  TenantNotificationProviderVerifyRequest
} from "@propertyflow/contracts";

const providers: TenantNotificationProvider[] = ["telegram", "line", "whatsapp"];

export class TenantNotificationProviderVerifyDto implements TenantNotificationProviderVerifyRequest {
  @ApiProperty({ enum: providers })
  @IsIn(providers)
  provider!: TenantNotificationProvider;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telegramBotToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lineChannelAccessToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  whatsappAccessToken?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  whatsappPhoneNumberId?: string;

  @ApiProperty({ required: false, example: "v20.0" })
  @IsOptional()
  @Matches(/^v\d+\.\d+$/)
  whatsappGraphApiVersion?: string;
}

export class TenantNotificationProviderConnectDto implements TenantNotificationProviderConnectRequest {
  @ApiProperty({ enum: providers })
  @IsIn(providers)
  provider!: TenantNotificationProvider;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  telegramBotToken?: string;
}

export class TenantNotificationProviderTestDto
  extends TenantNotificationProviderVerifyDto
  implements TenantNotificationProviderTestRequest
{
  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  telegramChatIds?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  lineRecipientIds?: string[];

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @Matches(/^\+?[1-9]\d{7,14}$/, { each: true })
  whatsappRecipients?: string[];
}

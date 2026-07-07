import { IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateLeadRequest, LeadSource, SearchEventSource } from "@propertyflow/contracts";

const leadSources: LeadSource[] = ["website", "public-api", "agent", "ai-chat", "ai-concierge", "saved-search"];
const searchEventSources: SearchEventSource[] = ["structured", "indexed", "ai"];
const locales: NonNullable<CreateLeadRequest["preferredLocale"]>[] = ["en", "ru", "th", "zh"];

export class CreateLeadDto implements CreateLeadRequest {
  @IsOptional()
  @IsString()
  propertyId?: string;

  @IsIn(leadSources)
  source!: LeadSource;

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
  @IsString()
  message?: string;

  @IsOptional()
  @IsIn(locales)
  preferredLocale?: CreateLeadRequest["preferredLocale"];

  @IsOptional()
  @IsString()
  assignedAgentId?: string;

  @IsOptional()
  @IsString()
  attributionSearchEventId?: string;

  @IsOptional()
  @IsString()
  attributionSearchQuery?: string;

  @IsOptional()
  @IsIn(searchEventSources)
  attributionSearchSource?: SearchEventSource;
}

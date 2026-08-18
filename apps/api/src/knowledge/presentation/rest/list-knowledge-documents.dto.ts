import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import type { KnowledgeDocumentKind, KnowledgeDocumentSearchRequest } from "@propertyflow/contracts";

const locales: NonNullable<KnowledgeDocumentSearchRequest["locale"]>[] = ["en", "ru", "th", "zh"];
const kinds: KnowledgeDocumentKind[] = ["article", "neighborhood", "relocation", "legal", "investment", "faq"];

export class ListKnowledgeDocumentsDto implements KnowledgeDocumentSearchRequest {
  @IsOptional()
  @IsString()
  query?: string;

  @IsOptional()
  @IsIn(locales)
  locale?: KnowledgeDocumentSearchRequest["locale"];

  @IsOptional()
  @IsIn(kinds)
  kind?: KnowledgeDocumentKind;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  excludeTag?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number;
}

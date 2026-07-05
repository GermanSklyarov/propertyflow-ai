import { IsArray, IsIn, IsOptional, IsString, MinLength } from "class-validator";
import type { CreateKnowledgeDocumentRequest, KnowledgeDocumentKind } from "@propertyflow/contracts";

const locales: CreateKnowledgeDocumentRequest["locale"][] = ["en", "ru", "th", "zh"];
const kinds: KnowledgeDocumentKind[] = ["article", "neighborhood", "relocation", "legal", "investment", "faq"];

export class CreateKnowledgeDocumentDto implements CreateKnowledgeDocumentRequest {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @MinLength(20)
  body!: string;

  @IsIn(locales)
  locale!: CreateKnowledgeDocumentRequest["locale"];

  @IsIn(kinds)
  kind!: KnowledgeDocumentKind;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

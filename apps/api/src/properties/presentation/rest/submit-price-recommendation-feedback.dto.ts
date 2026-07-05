import { IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import type {
  PropertyPriceRecommendation,
  PropertyPriceRecommendationFeedbackDecision,
  SubmitPropertyPriceRecommendationFeedbackRequest
} from "@propertyflow/contracts";
import type { Currency } from "@propertyflow/domain";

const currencies: Currency[] = ["THB", "USD", "EUR"];
const decisions: PropertyPriceRecommendationFeedbackDecision[] = ["accepted", "rejected", "adjusted"];
const engines: PropertyPriceRecommendation["engine"][] = ["baseline-comparables", "ml-model"];

class PriceFeedbackMoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(currencies)
  currency!: Currency;
}

export class SubmitPriceRecommendationFeedbackDto implements SubmitPropertyPriceRecommendationFeedbackRequest {
  @IsIn(engines)
  engine!: PropertyPriceRecommendation["engine"];

  @IsString()
  modelVersion!: string;

  @IsOptional()
  @IsString()
  recommendationGeneratedAt?: string;

  @ValidateNested()
  @Type(() => PriceFeedbackMoneyDto)
  suggestedPrice!: PriceFeedbackMoneyDto;

  @IsIn(decisions)
  decision!: PropertyPriceRecommendationFeedbackDecision;

  @IsOptional()
  @ValidateNested()
  @Type(() => PriceFeedbackMoneyDto)
  selectedPrice?: PriceFeedbackMoneyDto;

  @IsOptional()
  @IsString()
  note?: string;
}

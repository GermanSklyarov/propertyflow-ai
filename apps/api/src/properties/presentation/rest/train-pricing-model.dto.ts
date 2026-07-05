import { IsBoolean, IsIn, IsOptional, IsString } from "class-validator";
import type { PricingModelTrainJobPayload } from "@propertyflow/contracts";

const algorithms: PricingModelTrainJobPayload["algorithm"][] = ["baseline-refresh", "catboost", "lightgbm"];

export class TrainPricingModelDto {
  @IsString()
  modelVersion!: string;

  @IsIn(algorithms)
  algorithm!: PricingModelTrainJobPayload["algorithm"];

  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}

import { IsIn, IsOptional, IsString } from "class-validator";
import type { ReviewAiAssetRequest } from "@propertyflow/contracts";

export class ReviewAiAssetDto implements ReviewAiAssetRequest {
  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";

  @IsOptional()
  @IsString()
  note?: string;
}

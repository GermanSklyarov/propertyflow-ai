import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";

export class CreateSavedSearchAlertDigestJobDto {
  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

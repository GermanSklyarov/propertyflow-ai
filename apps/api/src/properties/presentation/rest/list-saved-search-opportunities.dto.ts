import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, Max, Min } from "class-validator";
import type { ListSavedSearchOpportunitiesRequest } from "@propertyflow/contracts";

export class ListSavedSearchOpportunitiesDto implements ListSavedSearchOpportunitiesRequest {
  @ApiProperty({ required: false, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;

  @ApiProperty({ required: false, minimum: 0, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  minScore?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }: { value: string | boolean | undefined }) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    return value === true || value === "true";
  })
  @IsBoolean()
  includeConverted?: boolean;
}

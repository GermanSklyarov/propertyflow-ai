import { ApiProperty } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from "class-validator";
import type { ListSavedSearchLeadCoverageRequest } from "@propertyflow/contracts";

const leadCoverageSorts = ["search-rank", "uncovered-first", "latest-lead"] as const;

export class ListSavedSearchLeadCoverageDto implements ListSavedSearchLeadCoverageRequest {
  @ApiProperty({ required: false, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @Transform(({ value }: { value: string | boolean | undefined }) => {
    if (value === undefined || value === "") {
      return undefined;
    }

    return value === true || value === "true";
  })
  @IsBoolean()
  onlyUncovered?: boolean;

  @ApiProperty({ required: false, enum: leadCoverageSorts })
  @IsOptional()
  @IsIn(leadCoverageSorts)
  sort?: ListSavedSearchLeadCoverageRequest["sort"];
}

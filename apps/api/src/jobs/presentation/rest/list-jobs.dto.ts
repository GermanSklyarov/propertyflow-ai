import { Transform, Type } from "class-transformer";
import { IsArray, IsIn, IsInt, IsOptional, Min } from "class-validator";
import type { BackgroundJobState } from "@propertyflow/contracts";

export const backgroundJobStates = [
  "active",
  "completed",
  "delayed",
  "failed",
  "paused",
  "prioritized",
  "waiting",
  "waiting-children"
] as const satisfies readonly BackgroundJobState[];

export class ListJobsDto {
  @IsOptional()
  @Transform(({ value }: { value: string | string[] | undefined }) => {
    if (!value) {
      return undefined;
    }

    if (Array.isArray(value)) {
      return value;
    }

    return value
      .split(",")
      .map((state) => state.trim())
      .filter(Boolean);
  })
  @IsArray()
  @IsIn(backgroundJobStates, { each: true })
  states?: BackgroundJobState[];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export function toListJobsQuery(query: ListJobsDto): { states: BackgroundJobState[]; limit?: number } {
  return {
    states: toStates(query.states) ?? [...backgroundJobStates],
    limit: toOptionalNumber(query.limit)
  };
}

function toStates(value: BackgroundJobState[] | string | undefined): BackgroundJobState[] | undefined {
  if (!value) {
    return undefined;
  }

  const states = Array.isArray(value)
    ? value
    : value
        .split(",")
        .map((state) => state.trim())
        .filter(Boolean);

  return states.filter((state): state is BackgroundJobState =>
    backgroundJobStates.includes(state as BackgroundJobState)
  );
}

function toOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}

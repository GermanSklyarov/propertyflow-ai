import { IsOptional, IsString } from "class-validator";
import type { IndexedPropertySearchRequest } from "@propertyflow/contracts";
import { SearchPropertiesDto, toPropertySearchRequest } from "./search-properties.dto.js";

export class IndexedSearchPropertiesDto
  extends SearchPropertiesDto
  implements Omit<IndexedPropertySearchRequest, "near">
{
  @IsOptional()
  @IsString()
  query?: string;

  toIndexedSearchRequest(): IndexedPropertySearchRequest {
    return toIndexedPropertySearchRequest(this);
  }
}

export function toIndexedPropertySearchRequest(query: IndexedSearchPropertiesDto): IndexedPropertySearchRequest {
  return {
    ...toPropertySearchRequest(query),
    query: query.query,
    limit: toOptionalNumber(query.limit),
    offset: toOptionalNumber(query.offset)
  };
}

function toOptionalNumber(value: number | string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  return Number(value);
}

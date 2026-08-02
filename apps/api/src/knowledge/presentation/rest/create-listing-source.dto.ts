import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsObject, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import type {
  CreateListingSourceRequest,
  ListingSourceAuthType,
  ListingSourceFieldMapping,
  ListingSourceImportMode,
  ListingSourceType
} from "@propertyflow/contracts";

const sourceTypes: ListingSourceType[] = ["rest-api", "xml-feed"];
const authTypes: ListingSourceAuthType[] = ["none", "bearer", "api-key-header"];
const importModes: ListingSourceImportMode[] = ["crm_inventory", "concierge_index_only", "hybrid"];

export class CreateListingSourceDto implements CreateListingSourceRequest {
  @ApiProperty({ example: "Agency website listing feed" })
  @IsString()
  @MinLength(3)
  name!: string;

  @ApiPropertyOptional({ enum: sourceTypes, default: "rest-api" })
  @IsOptional()
  @IsIn(sourceTypes)
  type?: ListingSourceType;

  @ApiProperty({ example: "https://agency.co.th/api/listings" })
  @IsUrl({ require_tld: false })
  endpointUrl!: string;

  @ApiPropertyOptional({ enum: authTypes, default: "none" })
  @IsOptional()
  @IsIn(authTypes)
  authType?: ListingSourceAuthType;

  @ApiPropertyOptional({ example: "x-api-key" })
  @IsOptional()
  @IsString()
  authHeaderName?: string;

  @ApiPropertyOptional({ example: "secret://demo-agency/listings-api-key" })
  @IsOptional()
  @IsString()
  authSecretRef?: string;

  @ApiPropertyOptional({ enum: importModes, default: "hybrid" })
  @IsOptional()
  @IsIn(importModes)
  importMode?: ListingSourceImportMode;

  @ApiProperty({
    example: {
      rootPath: "data.items",
      canonical: {
        externalId: "id",
        title: "name",
        market: "city",
        priceAmount: "sale_price",
        availableUntil: "rent_available_until"
      },
      customAttributes: [
        {
          key: "lease_available_until",
          sourcePath: "rent_available_until",
          type: "date",
          label: "Rent available until",
          description: "Do not recommend this listing for stays that end after this date.",
          filterHint: "availability",
          searchable: true
        }
      ],
      rawPayloadMode: "store_selected"
    }
  })
  @IsObject()
  mapping!: ListingSourceFieldMapping;
}

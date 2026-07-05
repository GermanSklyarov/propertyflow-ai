import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from "class-validator";
import type { UpdatePropertyPriceRequest } from "@propertyflow/contracts";
import type { Currency } from "@propertyflow/domain";

const currencies: Currency[] = ["THB", "USD", "EUR"];

class UpdatePriceMoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsIn(currencies)
  currency!: Currency;
}

export class UpdatePropertyPriceDto implements UpdatePropertyPriceRequest {
  @ValidateNested()
  @Type(() => UpdatePriceMoneyDto)
  price!: UpdatePriceMoneyDto;

  @IsOptional()
  @IsString()
  note?: string;
}

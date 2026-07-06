import { ApiProperty } from "@nestjs/swagger";
import { IsString, MinLength } from "class-validator";
import type { ConfirmPropertyImageDeleteRequest } from "@propertyflow/contracts";

export class ConfirmPropertyImageDeleteDto implements ConfirmPropertyImageDeleteRequest {
  @ApiProperty()
  @IsString()
  @MinLength(32)
  confirmationToken!: string;
}

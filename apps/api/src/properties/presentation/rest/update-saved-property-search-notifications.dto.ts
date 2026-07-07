import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";
import type { UpdateSavedPropertySearchNotificationsRequest } from "@propertyflow/contracts";

export class UpdateSavedPropertySearchNotificationsDto implements UpdateSavedPropertySearchNotificationsRequest {
  @ApiProperty()
  @IsBoolean()
  notificationsEnabled!: boolean;
}

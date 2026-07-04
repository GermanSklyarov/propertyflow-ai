import { IsString, MinLength } from "class-validator";
import type { AssignLeadRequest } from "@propertyflow/contracts";

export class AssignLeadDto implements AssignLeadRequest {
  @IsString()
  @MinLength(1)
  assignedAgentId!: string;
}


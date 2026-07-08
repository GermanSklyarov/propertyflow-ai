import { IsString, MaxLength, MinLength } from "class-validator";
import type { CreateLeadNoteRequest } from "@propertyflow/contracts";

export class CreateLeadNoteDto implements CreateLeadNoteRequest {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note!: string;
}

import { ArrayMinSize, IsArray, IsUUID } from "class-validator";
import type { ReorderPropertyImagesRequest } from "@propertyflow/contracts";

export class ReorderPropertyImagesDto implements ReorderPropertyImagesRequest {
  @IsArray()
  @ArrayMinSize(1)
  @IsUUID("4", { each: true })
  imageIds!: string[];
}

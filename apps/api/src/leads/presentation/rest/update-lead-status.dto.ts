import { IsIn } from "class-validator";
import type { LeadStatus, UpdateLeadStatusRequest } from "@propertyflow/contracts";

const leadStatuses: LeadStatus[] = ["new", "contacted", "qualified", "lost", "won"];

export class UpdateLeadStatusDto implements UpdateLeadStatusRequest {
  @IsIn(leadStatuses)
  status!: LeadStatus;
}

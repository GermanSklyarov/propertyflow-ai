import type { LeadPriority, LeadStatus } from "@propertyflow/contracts";

export const leadWorkflowStatusOptions: LeadStatus[] = ["new", "contacted", "qualified", "won", "lost"];

export const leadWorkflowPriorityOptions: LeadPriority[] = ["low", "medium", "high"];

export function formatLeadFollowUpDateTimeLocalValue(value?: string) {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

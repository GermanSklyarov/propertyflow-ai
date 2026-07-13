import { AlertTriangle, CalendarClock, CheckCircle2 } from "lucide-react";
import type { LeadSnapshot } from "@propertyflow/contracts";
import { formatDateTime } from "@shared/lib/formatters";

export function buildLeadFollowUpState(lead: LeadSnapshot) {
  if (!lead.nextFollowUpAt) {
    return { icon: <CalendarClock size={14} />, label: "No follow-up", tone: "neutralFollowUp" as const };
  }

  const followUpAt = new Date(lead.nextFollowUpAt);
  const now = new Date();

  if (followUpAt < now) {
    return {
      icon: <AlertTriangle size={14} />,
      label: `Overdue ${formatDateTime(lead.nextFollowUpAt)}`,
      tone: "dangerFollowUp" as const
    };
  }

  return {
    icon: <CheckCircle2 size={14} />,
    label: `Next ${formatDateTime(lead.nextFollowUpAt)}`,
    tone: "goodFollowUp" as const
  };
}

export function formatLeadOwner(agentId?: string) {
  return agentId ? agentId.replace("agent-", "Agent ").replace("demo-", "") : "Unassigned";
}

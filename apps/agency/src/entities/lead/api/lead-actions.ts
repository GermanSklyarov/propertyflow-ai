"use server";

import { revalidatePath } from "next/cache";
import type { LeadPriority, LeadStatus } from "@propertyflow/contracts";
import { addLeadNote, assignLead, linkLeadProperty, updateLeadContact, updateLeadFollowUp, updateLeadStatus } from "@shared/api/agency-client";

export async function addLeadNoteAction(leadId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();

  if (note.length < 2) {
    throw new Error("Lead note must be at least 2 characters.");
  }

  await addLeadNote(leadId, { note });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadStatusAction(leadId: string, formData: FormData) {
  const status = String(formData.get("status") ?? "").trim() as LeadStatus;

  if (!["new", "contacted", "qualified", "lost", "won"].includes(status)) {
    throw new Error("Choose a valid lead status.");
  }

  await updateLeadStatus(leadId, { status });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadFollowUpAction(leadId: string, formData: FormData) {
  const priority = String(formData.get("priority") ?? "").trim() as LeadPriority | "";
  const nextFollowUpAt = String(formData.get("nextFollowUpAt") ?? "").trim();

  if (!priority && !nextFollowUpAt) {
    throw new Error("Set a priority or follow-up time.");
  }

  if (priority && !["low", "medium", "high"].includes(priority)) {
    throw new Error("Choose a valid priority.");
  }

  await updateLeadFollowUp(leadId, {
    priority: priority || undefined,
    nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt).toISOString() : undefined
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function assignLeadAction(leadId: string, formData: FormData) {
  const assignedAgentId = String(formData.get("assignedAgentId") ?? "").trim();

  if (!assignedAgentId) {
    throw new Error("Choose an agent.");
  }

  await assignLead(leadId, { assignedAgentId });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function linkLeadPropertyAction(leadId: string, formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!propertyId) {
    throw new Error("Choose a listing.");
  }

  await linkLeadProperty(leadId, {
    propertyId,
    note: note || undefined
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

export async function updateLeadContactAction(leadId: string, formData: FormData) {
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const contactPhone = String(formData.get("contactPhone") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!contactEmail && !contactPhone) {
    throw new Error("Add an email or phone number.");
  }

  await updateLeadContact(leadId, {
    contactEmail: contactEmail || undefined,
    contactPhone: contactPhone || undefined,
    note: note || undefined
  });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

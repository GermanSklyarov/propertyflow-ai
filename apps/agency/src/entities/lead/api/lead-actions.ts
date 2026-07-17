"use server";

import { revalidatePath } from "next/cache";
import { addLeadNote } from "@shared/api/agency-client";

export async function addLeadNoteAction(leadId: string, formData: FormData) {
  const note = String(formData.get("note") ?? "").trim();

  if (note.length < 2) {
    throw new Error("Lead note must be at least 2 characters.");
  }

  await addLeadNote(leadId, { note });

  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
}

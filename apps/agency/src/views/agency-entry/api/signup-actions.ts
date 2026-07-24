"use server";

import { redirect } from "next/navigation";
import { resolveSignupPlan } from "../model/agency-entry";

export async function submitAgencySignup(formData: FormData) {
  const plan = resolveSignupPlan(String(formData.get("plan") ?? "starter"));

  redirect(`/setup?plan=${plan}`);
}

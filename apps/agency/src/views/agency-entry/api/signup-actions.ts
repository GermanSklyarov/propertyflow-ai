"use server";

import { redirect } from "next/navigation";
import { provisionTenant } from "@shared/api/agency-client";
import { setSelectedTenantId } from "@shared/lib/tenant-session";
import { parseAgencySignupForm, toProvisionTenantRequest } from "../model/agency-entry";

export async function submitAgencySignup(formData: FormData) {
  const values = parseAgencySignupForm(formData);
  const provisioned = await provisionTenant(toProvisionTenantRequest(values)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("409") ? "workspace-exists" : "provision-failed";

    redirect(`/signup?plan=${values.plan}&error=${code}`);
  });

  await setSelectedTenantId(provisioned.tenant.id);

  redirect(`/setup?plan=${provisioned.tenant.subscriptionPlan}`);
}

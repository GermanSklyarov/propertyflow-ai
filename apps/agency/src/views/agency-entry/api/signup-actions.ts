"use server";

import { redirect } from "next/navigation";
import { createAgencySession, provisionTenant } from "@shared/api/agency-client";
import { setAgencyAccessToken, setSelectedTenantId } from "@shared/lib/tenant-session";
import {
  parseAgencySigninForm,
  parseAgencySignupForm,
  toCreateAgencySessionRequest,
  toProvisionTenantRequest
} from "../model/agency-entry";

export async function submitAgencySignup(formData: FormData) {
  const values = parseAgencySignupForm(formData);
  const provisioned = await provisionTenant(toProvisionTenantRequest(values)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("409") ? "workspace-exists" : "provision-failed";

    redirect(`/signup?plan=${values.plan}&error=${code}`);
  });

  await setAgencyAccessToken(provisioned.accessToken);
  await setSelectedTenantId(provisioned.tenant.id);

  redirect(`/setup?plan=${provisioned.tenant.subscriptionPlan}`);
}

export async function submitAgencySignin(formData: FormData) {
  const values = parseAgencySigninForm(formData);
  const session = await createAgencySession(toCreateAgencySessionRequest(values)).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    const code = message.includes("403") ? "session-forbidden" : "session-failed";

    redirect(`/signin?error=${code}`);
  });

  await setAgencyAccessToken(session.accessToken);
  await setSelectedTenantId(session.tenant.id);

  redirect(session.setupUrl);
}

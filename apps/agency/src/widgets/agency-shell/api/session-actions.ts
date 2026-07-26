"use server";

import { redirect } from "next/navigation";
import { logoutAgencySession } from "@shared/api/agency-client";
import { clearAgencySession, getAgencySession } from "@shared/lib/tenant-session";

export async function submitAgencyLogout() {
  const session = await getAgencySession();

  if (session) {
    await logoutAgencySession({
      refreshToken: session.refreshToken,
      tenantId: session.tenantId
    }).catch(() => undefined);
  }

  await clearAgencySession();
  redirect("/signin?status=signed-out");
}

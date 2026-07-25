import { cookies } from "next/headers";

const selectedTenantCookie = "propertyflow-agency-tenant";

export async function getSelectedTenantId() {
  return (await cookies()).get(selectedTenantCookie)?.value;
}

export async function setSelectedTenantId(tenantId: string) {
  (await cookies()).set(selectedTenantCookie, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/"
  });
}

import type { Metadata } from "next";
import { getCurrentTenant } from "@shared/api/agency-client";
import { getSelectedTenantId } from "@shared/lib/tenant-session";
import { AgencyShell } from "@widgets/agency-shell/ui/agency-shell";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow Agency",
  description: "Agency operations dashboard for PropertyFlow AI"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tenantId = await getSelectedTenantId();
  const tenant = await getCurrentTenant({ tenantId }).catch(() => null);

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AgencyShell subscriptionPlan={tenant?.subscriptionPlan}>{children}</AgencyShell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import { getCurrentTenant } from "@shared/api/agency-client";
import { getAgencySession } from "@shared/lib/tenant-session";
import { AgencyShell } from "@widgets/agency-shell/ui/agency-shell";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow Agency",
  description: "Agency operations dashboard for PropertyFlow AI",
  other: {
    google: "notranslate"
  }
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAgencySession();
  const tenant = session ? await getCurrentTenant({ tenantId: session.tenantId }).catch(() => null) : null;

  return (
    <html className="notranslate" lang="en" translate="no">
      <body suppressHydrationWarning translate="no">
        <AgencyShell isAuthenticated={Boolean(session)} subscriptionPlan={tenant?.subscriptionPlan}>
          {children}
        </AgencyShell>
      </body>
    </html>
  );
}

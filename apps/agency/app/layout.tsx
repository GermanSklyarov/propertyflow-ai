import type { Metadata } from "next";
import { getCurrentTenant } from "@shared/api/agency-client";
import { AgencyShell } from "@widgets/agency-shell/ui/agency-shell";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow Agency",
  description: "Agency operations dashboard for PropertyFlow AI"
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const tenant = await getCurrentTenant().catch(() => null);

  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AgencyShell subscriptionPlan={tenant?.subscriptionPlan}>{children}</AgencyShell>
      </body>
    </html>
  );
}

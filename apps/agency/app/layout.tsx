import type { Metadata } from "next";
import Script from "next/script";
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

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = await getAgencySession();
  const tenant = session
    ? await getCurrentTenant({ revalidateSeconds: false, tenantId: session.tenantId }).catch(() => null)
    : null;

  return (
    <html className="notranslate" lang="en" suppressHydrationWarning translate="no">
      <head>
        <Script
          id="strip-extension-hydration-attrs"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
(() => {
  const strip = (node) => {
    if (node && node.nodeType === 1 && node.hasAttribute("bis_skin_checked")) {
      node.removeAttribute("bis_skin_checked");
    }
  };
  const stripAll = () => document.querySelectorAll("[bis_skin_checked]").forEach(strip);
  stripAll();
  new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      strip(mutation.target);
    }
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["bis_skin_checked"], subtree: true });
})();
`
          }}
        />
      </head>
      <body suppressHydrationWarning translate="no">
        <AgencyShell isAuthenticated={Boolean(session)} subscriptionPlan={tenant?.subscriptionPlan}>
          {children}
        </AgencyShell>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import Script from "next/script";
import { AppProviders } from "@app/providers";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow AI",
  description: "AI-first Thailand property search and relocation advisor"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
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
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

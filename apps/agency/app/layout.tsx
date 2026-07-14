import type { Metadata } from "next";
import { AgencyShell } from "@widgets/agency-shell/ui/agency-shell";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow Agency",
  description: "Agency operations dashboard for PropertyFlow AI"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AgencyShell>{children}</AgencyShell>
      </body>
    </html>
  );
}

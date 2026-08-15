import type { Metadata } from "next";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow Super Admin",
  description: "Starter pilot usage, cost, ROI, and operations dashboard"
};

export const dynamic = "force-dynamic";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

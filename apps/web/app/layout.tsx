import type { Metadata } from "next";
import { AppProviders } from "@app/providers";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow AI",
  description: "AI-first Thailand property search and relocation advisor"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}

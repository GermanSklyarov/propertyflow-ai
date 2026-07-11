import type { Metadata } from "next";
import "@shared/styles/globals.css";

export const metadata: Metadata = {
  title: "PropertyFlow Agency",
  description: "Agency operations dashboard for PropertyFlow AI"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

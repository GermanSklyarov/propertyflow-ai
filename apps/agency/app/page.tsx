import type { Metadata } from "next";
import { AgencyEntryPage } from "@views/agency-entry/ui/agency-entry-page";

export const metadata: Metadata = {
  title: "PropertyFlow AI for Agencies",
  description: "Launch an AI Sales Assistant that qualifies Thailand real estate website visitors before CRM migration."
};

export default function AgencyHomePage() {
  return <AgencyEntryPage />;
}

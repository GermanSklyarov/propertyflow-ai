import type { Metadata } from "next";
import { AgencyEntryPage } from "@views/agency-entry/ui/agency-entry-page";

export const metadata: Metadata = {
  title: "PropertyFlow AI for Agencies",
  description: "Launch an AI Concierge on a Thailand real estate agency website without migrating CRM first."
};

export default function AgencyHomePage() {
  return <AgencyEntryPage />;
}

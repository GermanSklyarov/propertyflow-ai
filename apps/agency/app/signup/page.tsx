import type { Metadata } from "next";
import { buildAgencySignupSummary, resolveSignupPlan } from "@views/agency-entry/model/agency-entry";
import { SignupEntryPage } from "@views/agency-entry/ui/agency-entry-page";

export const metadata: Metadata = {
  title: "Create workspace | PropertyFlow AI",
  description: "Create a PropertyFlow AI agency workspace and continue into Starter setup."
};

export default async function Page({ searchParams }: { searchParams: Promise<{ plan?: string | string[] }> }) {
  const { plan } = await searchParams;
  const signup = buildAgencySignupSummary(resolveSignupPlan(plan));

  return <SignupEntryPage signup={signup} />;
}

import type { Metadata } from "next";
import { resolveAgencySigninError } from "@views/agency-entry/model/agency-entry";
import { SigninEntryPage } from "@views/agency-entry/ui/agency-entry-page";

export const metadata: Metadata = {
  title: "Sign in | PropertyFlow AI",
  description: "Create a secure PropertyFlow AI agency workspace session."
};

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string | string[] }> }) {
  const { error } = await searchParams;

  return <SigninEntryPage errorMessage={resolveAgencySigninError(error)} />;
}

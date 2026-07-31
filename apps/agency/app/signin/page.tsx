import type { Metadata } from "next";
import { resolveAgencySigninError } from "@views/agency-entry/model/agency-entry";
import { SigninEntryPage } from "@views/agency-entry/ui/agency-entry-page";

export const metadata: Metadata = {
  title: "Sign in | PropertyFlow AI",
  description: "Create a secure PropertyFlow AI agency workspace session."
};

export default async function Page({
  searchParams
}: {
  searchParams: Promise<{
    devLink?: string | string[];
    error?: string | string[];
    sent?: string | string[];
    workspace?: string | string[];
  }>;
}) {
  const { devLink, error, sent, workspace } = await searchParams;

  return (
    <SigninEntryPage
      developmentMagicLinkHref={Array.isArray(devLink) ? devLink[0] : devLink}
      errorMessage={resolveAgencySigninError(error)}
      linkSent={Boolean(Array.isArray(sent) ? sent[0] : sent)}
      linkSentWorkspace={Array.isArray(workspace) ? workspace[0] : workspace}
    />
  );
}

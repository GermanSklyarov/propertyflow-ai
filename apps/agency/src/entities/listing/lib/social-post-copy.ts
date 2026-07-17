import type { PropertySocialPostDraft } from "@propertyflow/contracts";

export function composeSocialPostText(
  draft: Pick<PropertySocialPostDraft, "body" | "cta" | "hashtags" | "hook"> & {
    leadCaptureUrl?: string;
  }
) {
  return [draft.hook, draft.body, draft.cta, draft.leadCaptureUrl ?? "", draft.hashtags.join(" ")]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

export function buildPublicLeadCaptureUrl(leadCapturePath: string, baseUrl = process.env.NEXT_PUBLIC_PROPERTYFLOW_WEB_URL ?? "http://localhost:3000") {
  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
  const normalizedPath = leadCapturePath.startsWith("/") ? leadCapturePath : `/${leadCapturePath}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}

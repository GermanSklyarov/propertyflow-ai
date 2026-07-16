import type { PropertySocialPostDraft } from "@propertyflow/contracts";

export function composeSocialPostText(
  draft: Pick<PropertySocialPostDraft, "body" | "cta" | "hashtags" | "hook">
) {
  return [draft.hook, draft.body, draft.cta, draft.hashtags.join(" ")]
    .map((part) => part.trim())
    .filter(Boolean)
    .join("\n\n");
}

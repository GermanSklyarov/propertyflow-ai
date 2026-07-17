import type {
  PropertySocialPostDraft,
  PropertySocialPostPublication,
  PropertySocialPostReview,
  PropertySocialPostWorkflowStage
} from "@propertyflow/contracts";

export type SocialPostPublicationStatus = "idle" | "saving" | "published" | "error";
export type SocialPostWorkflowStageKey = PropertySocialPostDraft["approvalWorkflow"]["currentStage"];

export function getInitialPublicationStatus(publication?: PropertySocialPostPublication): SocialPostPublicationStatus {
  return publication ? "published" : "idle";
}

export function getInitialWorkflowStage(
  draft: PropertySocialPostDraft,
  publication?: PropertySocialPostPublication,
  review?: PropertySocialPostReview
): SocialPostWorkflowStageKey {
  if (publication) {
    return "published";
  }

  if (review?.status === "approved") {
    return "approved";
  }

  if (review?.status === "review_requested") {
    return "review";
  }

  return draft.approvalWorkflow.currentStage;
}

export function getWorkflowStages(
  stages: PropertySocialPostWorkflowStage[],
  currentStage: SocialPostWorkflowStageKey
) {
  const order: SocialPostWorkflowStageKey[] = ["draft", "review", "approved", "published"];
  const currentIndex = order.indexOf(currentStage);

  return stages.map((stage) => {
    const stageIndex = order.indexOf(stage.key);

    if (stageIndex < currentIndex) {
      return { ...stage, state: "complete" as const };
    }

    if (stageIndex === currentIndex) {
      return { ...stage, state: "current" as const };
    }

    return { ...stage, state: "pending" as const };
  });
}

export function capitalizeWorkflowState(value: PropertySocialPostWorkflowStage["state"]) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}

export function formatWorkflowAction(action: PropertySocialPostDraft["approvalWorkflow"]["allowedActions"][number]) {
  return action
    .split("-")
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

export function formatWorkflowStage(label: string) {
  return label === "Approved" ? "Approve" : label === "Published" ? "Publish" : label;
}

export function getCurrentWorkflowLabel(stages: PropertySocialPostWorkflowStage[]) {
  return stages.find((stage) => stage.state === "current")?.label ?? "Draft";
}

export function shortenIdentifier(value: string) {
  return value.length > 38 ? `${value.slice(0, 18)}...${value.slice(-14)}` : value;
}

export function formatPublicationStatus(status: SocialPostPublicationStatus) {
  if (status === "saving") {
    return "Saving";
  }

  if (status === "published") {
    return "Published";
  }

  if (status === "error") {
    return "Retry publish";
  }

  return "Mark published";
}

export function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function getWorkflowNote(
  stage: SocialPostWorkflowStageKey,
  publicationStatus: SocialPostPublicationStatus,
  fallback: string
) {
  if (publicationStatus === "published") {
    return "Published and tracked for lead attribution.";
  }

  if (publicationStatus === "saving") {
    return "Saving publication marker...";
  }

  if (publicationStatus === "error") {
    return "Publication marker failed. Check the API and retry.";
  }

  if (stage === "approved") {
    return "Approved for publishing. Mark it as published after the agent posts it.";
  }

  if (stage === "review") {
    return "Queued for manager review before this post goes live.";
  }

  return fallback;
}

import { mutationOptions } from "@tanstack/react-query";
import type { ConciergeRequest } from "@propertyflow/contracts";
import { askConcierge } from "../../../shared/api/propertyflow-client";

export function askConciergeMutationOptions() {
  return mutationOptions({
    mutationFn: (request: ConciergeRequest) => askConcierge(request)
  });
}

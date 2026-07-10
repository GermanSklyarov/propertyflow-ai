import { mutationOptions } from "@tanstack/react-query";
import type { CreateLeadRequest } from "@propertyflow/contracts";
import { createWebsiteLead } from "@shared/api/propertyflow-client";

export function createWebsiteLeadMutationOptions() {
  return mutationOptions({
    mutationFn: (request: Omit<CreateLeadRequest, "source">) => createWebsiteLead(request)
  });
}

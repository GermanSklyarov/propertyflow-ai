import { mutationOptions } from "@tanstack/react-query";
import type { CreateSavedPropertySearchRequest } from "@propertyflow/contracts";
import { createSavedPropertySearch } from "@shared/api/propertyflow-client";

export function createSavedPropertySearchMutationOptions() {
  return mutationOptions({
    mutationFn: (request: CreateSavedPropertySearchRequest) => createSavedPropertySearch(request)
  });
}

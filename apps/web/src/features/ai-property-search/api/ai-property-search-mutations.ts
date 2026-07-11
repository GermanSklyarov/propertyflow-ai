import { mutationOptions } from "@tanstack/react-query";
import type { NaturalLanguageSearchRequest } from "@propertyflow/contracts";
import { searchPropertiesByNaturalLanguage } from "@shared/api/propertyflow-client";

export function aiPropertySearchMutationOptions() {
  return mutationOptions({
    mutationFn: (request: NaturalLanguageSearchRequest) => searchPropertiesByNaturalLanguage(request)
  });
}

import { mutationOptions } from "@tanstack/react-query";
import type { ComparePropertiesRequest } from "@propertyflow/contracts";
import { compareProperties } from "@shared/api/propertyflow-client";

export function comparePropertiesMutationOptions() {
  return mutationOptions({
    mutationFn: (request: ComparePropertiesRequest) => compareProperties(request)
  });
}

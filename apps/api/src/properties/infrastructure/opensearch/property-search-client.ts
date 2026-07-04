import { Client } from "@opensearch-project/opensearch";
import { loadAppConfig } from "@propertyflow/config";

export const PROPERTY_SEARCH_CLIENT = Symbol("PROPERTY_SEARCH_CLIENT");

export function createPropertySearchClient(): Client {
  return new Client({
    node: loadAppConfig().opensearchUrl
  });
}

import { QueryClient } from "@tanstack/react-query";

export function createPropertyFlowQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        retry: 1,
        staleTime: 30_000
      }
    }
  });
}

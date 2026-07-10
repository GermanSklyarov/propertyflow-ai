"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createPropertyFlowQueryClient } from "@shared/query/query-client";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState<QueryClient>(() => createPropertyFlowQueryClient());

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

import { queryOptions } from "@tanstack/react-query";

import { getApiFetch } from "~/shared/api/eden-fetch";

export const healthQueryOptions = queryOptions({
  queryFn: async () => {
    const response = await getApiFetch()("/api/health", {
      body: {},
      headers: {},
      method: "GET",
    });

    if (response.error || !response.data) {
      throw new Error("Health check failed");
    }

    return response.data;
  },
  queryKey: ["api", "health"] as const,
  retry: false,
  staleTime: 30_000,
});

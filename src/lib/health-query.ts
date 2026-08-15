import { queryOptions } from "@tanstack/react-query";

import { getTreaty } from "../routes/api.$";

export const healthQueryOptions = queryOptions({
  queryFn: async () => {
    const response = await getTreaty().health.get();

    if (response.error || !response.data) {
      throw new Error("Health check failed");
    }

    return response.data;
  },
  queryKey: ["api", "health"] as const,
  retry: false,
  staleTime: 30_000,
});

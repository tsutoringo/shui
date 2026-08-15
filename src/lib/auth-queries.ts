import { queryOptions } from "@tanstack/react-query";

import { authClient } from "./auth-client";

export const authQueryKeys = {
  session: ["auth", "session"] as const,
};

export const sessionQueryOptions = queryOptions({
  queryFn: async () => {
    const { data, error } = await authClient.getSession();

    if (error?.status === 401) {
      return null;
    }

    if (error) {
      throw error;
    }

    return data ?? null;
  },
  queryKey: authQueryKeys.session,
  retry: false,
  staleTime: 60_000,
});

import { queryOptions } from "@tanstack/react-query";

import { getAdminAccess } from "~/features/admin/api/client";

export const adminQueryKeys = {
  access: ["admin-access"] as const,
};

export const adminAccessQueryOptions = queryOptions({
  queryFn: getAdminAccess,
  queryKey: adminQueryKeys.access,
  retry: false,
  staleTime: 60_000,
});

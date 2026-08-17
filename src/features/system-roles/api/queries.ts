import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { getSystemRoles, grantUserRole, revokeUserRole } from "~/features/system-roles/api/client";
import { userQueryKeys, usersQueryOptions } from "~/features/users/api/queries";

export const systemRoleQueryKeys = {
  all: ["system-roles"] as const,
};

export const systemRolesQueryOptions = queryOptions({
  queryFn: getSystemRoles,
  queryKey: systemRoleQueryKeys.all,
  retry: false,
});

export const grantUserRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, roleKey }: { id: string; roleKey: string }) => grantUserRole(id, roleKey),
  });

export const revokeUserRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, roleKey }: { id: string; roleKey: string }) => revokeUserRole(id, roleKey),
  });

export { userQueryKeys, usersQueryOptions };

import { mutationOptions, queryOptions } from "@tanstack/react-query";

import { getUsers, repairUser, setUserStatus } from "~/features/users/api/client";

export const userQueryKeys = {
  all: ["users"] as const,
};

export const usersQueryOptions = queryOptions({
  queryFn: getUsers,
  queryKey: userQueryKeys.all,
  retry: false,
});

export const repairUserMutationOptions = () => mutationOptions({ mutationFn: repairUser });

export const setUserStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      setUserStatus(id, status),
  });

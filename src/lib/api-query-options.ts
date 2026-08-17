import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  acceptInvitation,
  addTeamMember,
  completeBootstrap,
  createInvitation,
  createServiceAccount,
  createTeam,
  deleteTeam,
  getInvitation,
  getAdminAccess,
  getServiceAccounts,
  getServiceAccountOwners,
  getSystemRoles,
  getTeams,
  getUsers,
  grantUserRole,
  removeTeamMember,
  repairUser,
  reserveBootstrap,
  revokeUserRole,
  setServiceAccountStatus,
  setTeamStatus,
  setUserStatus,
  transferServiceAccount,
  updateServiceAccount,
  updateTeam,
} from "./api-client";
import type {
  InvitationAcceptBody,
  ServiceAccountUpdateBody,
  TeamUpdateBody,
  OwnershipBody,
} from "../server/modules/models";

export const apiQueryKeys = {
  adminAccess: ["admin-access"] as const,
  serviceAccounts: ["service-accounts"] as const,
  serviceAccountOwners: ["service-account-owners"] as const,
  systemRoles: ["system-roles"] as const,
  teams: ["teams"] as const,
  users: ["users"] as const,
};

export const adminAccessQueryOptions = queryOptions({
  queryFn: getAdminAccess,
  queryKey: apiQueryKeys.adminAccess,
  retry: false,
  staleTime: 60_000,
});

export const usersQueryOptions = queryOptions({
  queryFn: getUsers,
  queryKey: apiQueryKeys.users,
  retry: false,
});

export const teamsQueryOptions = queryOptions({
  queryFn: getTeams,
  queryKey: apiQueryKeys.teams,
  retry: false,
});

export const serviceAccountsQueryOptions = queryOptions({
  queryFn: getServiceAccounts,
  queryKey: apiQueryKeys.serviceAccounts,
  retry: false,
});

export const serviceAccountOwnersQueryOptions = queryOptions({
  queryFn: getServiceAccountOwners,
  queryKey: apiQueryKeys.serviceAccountOwners,
  retry: false,
  staleTime: 60_000,
});

export const systemRolesQueryOptions = queryOptions({
  queryFn: getSystemRoles,
  queryKey: apiQueryKeys.systemRoles,
  retry: false,
});

export const invitationQueryOptions = (token: string) =>
  queryOptions({
    queryFn: () => getInvitation(token),
    queryKey: ["invitations", token] as const,
    retry: false,
  });

export const reserveBootstrapMutationOptions = () =>
  mutationOptions({ mutationFn: reserveBootstrap });

export const completeBootstrapMutationOptions = () =>
  mutationOptions({ mutationFn: completeBootstrap });

export const createInvitationMutationOptions = () =>
  mutationOptions({ mutationFn: createInvitation });

export const acceptInvitationMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ token, body }: { body: InvitationAcceptBody; token: string }) =>
      acceptInvitation(token, body),
  });

export const repairUserMutationOptions = () => mutationOptions({ mutationFn: repairUser });

export const setUserStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      setUserStatus(id, status),
  });

export const grantUserRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, roleKey }: { id: string; roleKey: string }) => grantUserRole(id, roleKey),
  });

export const revokeUserRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, roleKey }: { id: string; roleKey: string }) => revokeUserRole(id, roleKey),
  });

export const createTeamMutationOptions = () => mutationOptions({ mutationFn: createTeam });

export const updateTeamMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, body }: { body: TeamUpdateBody; id: string }) => updateTeam(id, body),
  });

export const setTeamStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      setTeamStatus(id, status),
  });

export const deleteTeamMutationOptions = () => mutationOptions({ mutationFn: deleteTeam });

export const addTeamMemberMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ teamId, body }: { teamId: string; body: Parameters<typeof addTeamMember>[1] }) =>
      addTeamMember(teamId, body),
  });

export const removeTeamMemberMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      removeTeamMember(teamId, userId),
  });

export const createServiceAccountMutationOptions = () =>
  mutationOptions({ mutationFn: createServiceAccount });

export const updateServiceAccountMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, body }: { body: ServiceAccountUpdateBody; id: string }) =>
      updateServiceAccount(id, body),
  });

export const transferServiceAccountMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: OwnershipBody; id: string }) =>
      transferServiceAccount(id, body),
  });

export const setServiceAccountStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      setServiceAccountStatus(id, status),
  });

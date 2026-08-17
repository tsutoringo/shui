import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  acceptInvitation,
  addTeamMember,
  createApplication,
  createApplicationClient,
  createApplicationRole,
  completeBootstrap,
  createInvitation,
  createServiceAccount,
  createTeam,
  deleteTeam,
  deleteApplication,
  deleteApplicationClient,
  deleteApplicationRole,
  getApplicationAccess,
  getApplicationClients,
  getApplicationOwners,
  getApplicationRoles,
  getApplications,
  getInvitation,
  getAdminAccess,
  getServiceAccounts,
  getServiceAccountOwners,
  getSystemRoles,
  getTeams,
  getUsers,
  grantUserRole,
  grantApplicationRole,
  removeApplicationAssignment,
  removeTeamMember,
  repairUser,
  reserveBootstrap,
  revokeUserRole,
  revokeApplicationRole,
  setApplicationAssignment,
  setApplicationClientStatus,
  setApplicationStatus,
  setServiceAccountStatus,
  setTeamStatus,
  setUserStatus,
  transferServiceAccount,
  transferApplicationOwnership,
  updateApplication,
  updateApplicationClient,
  updateApplicationRole,
  updateServiceAccount,
  updateTeam,
} from "./api-client";
import type {
  InvitationAcceptBody,
  ServiceAccountUpdateBody,
  TeamUpdateBody,
  OwnershipBody,
  ApplicationAssignmentBody,
  ApplicationClientUpdateBody,
  ApplicationRoleUpdateBody,
  ApplicationUpdateBody,
} from "../server/modules/models";

export const apiQueryKeys = {
  adminAccess: ["admin-access"] as const,
  applications: ["applications"] as const,
  applicationOwners: ["application-owners"] as const,
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

export const applicationsQueryOptions = queryOptions({
  queryFn: getApplications,
  queryKey: apiQueryKeys.applications,
  retry: false,
});

export const applicationOwnersQueryOptions = queryOptions({
  queryFn: getApplicationOwners,
  queryKey: apiQueryKeys.applicationOwners,
  retry: false,
  staleTime: 60_000,
});

export const applicationRolesQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getApplicationRoles(id),
    queryKey: [...apiQueryKeys.applications, id, "roles"] as const,
    retry: false,
  });

export const applicationAccessQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getApplicationAccess(id),
    queryKey: [...apiQueryKeys.applications, id, "access"] as const,
    retry: false,
  });

export const applicationClientsQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getApplicationClients(id),
    queryKey: [...apiQueryKeys.applications, id, "clients"] as const,
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

export const createApplicationMutationOptions = () =>
  mutationOptions({ mutationFn: createApplication });

export const updateApplicationMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: ApplicationUpdateBody; id: string }) =>
      updateApplication(id, body),
  });

export const transferApplicationOwnershipMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: OwnershipBody; id: string }) =>
      transferApplicationOwnership(id, body),
  });

export const setApplicationStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      setApplicationStatus(id, status),
  });

export const deleteApplicationMutationOptions = () =>
  mutationOptions({ mutationFn: deleteApplication });

export const createApplicationRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: Parameters<typeof createApplicationRole>[1]; id: string }) =>
      createApplicationRole(id, body),
  });

export const updateApplicationRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      body,
      id,
      roleKey,
    }: {
      body: ApplicationRoleUpdateBody;
      id: string;
      roleKey: string;
    }) => updateApplicationRole(id, roleKey, body),
  });

export const deleteApplicationRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, roleKey }: { id: string; roleKey: string }) =>
      deleteApplicationRole(id, roleKey),
  });

export const setApplicationAssignmentMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: ApplicationAssignmentBody; id: string }) =>
      setApplicationAssignment(id, body),
  });

export const removeApplicationAssignmentMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      id,
      subjectId,
      subjectType,
    }: {
      id: string;
      subjectId: string;
      subjectType: "user" | "service-account" | "team";
    }) => removeApplicationAssignment(id, subjectType, subjectId),
  });

export const grantApplicationRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: Parameters<typeof grantApplicationRole>[1]; id: string }) =>
      grantApplicationRole(id, body),
  });

export const revokeApplicationRoleMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      id,
      roleKey,
      subjectId,
      subjectType,
    }: {
      id: string;
      roleKey: string;
      subjectId: string;
      subjectType: "user" | "service-account" | "team";
    }) => revokeApplicationRole(id, subjectType, subjectId, roleKey),
  });

export const createApplicationClientMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      body,
      id,
    }: {
      body: Parameters<typeof createApplicationClient>[1];
      id: string;
    }) => createApplicationClient(id, body),
  });

export const updateApplicationClientMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      body,
      clientId,
      id,
    }: {
      body: ApplicationClientUpdateBody;
      clientId: string;
      id: string;
    }) => updateApplicationClient(id, clientId, body),
  });

export const setApplicationClientStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      clientId,
      id,
      status,
    }: {
      clientId: string;
      id: string;
      status: "active" | "disabled";
    }) => setApplicationClientStatus(id, clientId, status),
  });

export const deleteApplicationClientMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ clientId, id }: { clientId: string; id: string }) =>
      deleteApplicationClient(id, clientId),
  });

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

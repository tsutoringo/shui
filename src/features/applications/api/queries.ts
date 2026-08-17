import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  createApplication,
  createApplicationClient,
  createApplicationRole,
  deleteApplication,
  deleteApplicationClient,
  deleteApplicationRole,
  getApplicationAccess,
  getApplicationClients,
  getApplicationOwners,
  getApplicationRoles,
  getApplications,
  grantApplicationRole,
  removeApplicationAssignment,
  revokeApplicationRole,
  setApplicationAssignment,
  setApplicationClientStatus,
  setApplicationStatus,
  transferApplicationOwnership,
  updateApplication,
  updateApplicationClient,
  updateApplicationRole,
} from "~/features/applications/api/client";
import type {
  ApplicationAssignmentBody,
  ApplicationClientUpdateBody,
  ApplicationRoleUpdateBody,
  ApplicationUpdateBody,
  OwnershipBody,
} from "~/server/modules/models";

export const applicationQueryKeys = {
  all: ["applications"] as const,
  owners: ["application-owners"] as const,
  detail: (id: string) => ["applications", id] as const,
  roles: (id: string) => ["applications", id, "roles"] as const,
  access: (id: string) => ["applications", id, "access"] as const,
  clients: (id: string) => ["applications", id, "clients"] as const,
};

export const applicationsQueryOptions = queryOptions({
  queryFn: getApplications,
  queryKey: applicationQueryKeys.all,
  retry: false,
});

export const applicationOwnersQueryOptions = queryOptions({
  queryFn: getApplicationOwners,
  queryKey: applicationQueryKeys.owners,
  retry: false,
  staleTime: 60_000,
});

export const applicationRolesQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getApplicationRoles(id),
    queryKey: applicationQueryKeys.roles(id),
    retry: false,
  });

export const applicationAccessQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getApplicationAccess(id),
    queryKey: applicationQueryKeys.access(id),
    retry: false,
  });

export const applicationClientsQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getApplicationClients(id),
    queryKey: applicationQueryKeys.clients(id),
    retry: false,
  });

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

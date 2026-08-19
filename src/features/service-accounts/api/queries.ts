import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  createServiceAccount,
  createServiceAccountCredential,
  deleteServiceAccountCredential,
  getServiceAccountCredentials,
  getServiceAccountOwners,
  getServiceAccounts,
  rotateServiceAccountCredential,
  setServiceAccountCredentialStatus,
  setServiceAccountStatus,
  transferServiceAccount,
  updateServiceAccount,
} from "~/features/service-accounts/api/client";
import {
  applicationQueryKeys,
  applicationsQueryOptions,
} from "~/features/applications/api/queries";
import type { OwnershipBody } from "~/server/modules/models/common";
import type { ServiceAccountUpdateBody } from "~/server/modules/service-accounts/models";

export const serviceAccountQueryKeys = {
  all: ["service-accounts"] as const,
  owners: ["service-account-owners"] as const,
  credentials: (id: string) => ["service-accounts", id, "credentials"] as const,
};

export const serviceAccountsQueryOptions = queryOptions({
  queryFn: getServiceAccounts,
  queryKey: serviceAccountQueryKeys.all,
  retry: false,
});

export const serviceAccountOwnersQueryOptions = queryOptions({
  queryFn: getServiceAccountOwners,
  queryKey: serviceAccountQueryKeys.owners,
  retry: false,
  staleTime: 60_000,
});

export const serviceAccountCredentialsQueryOptions = (id: string) =>
  queryOptions({
    queryFn: () => getServiceAccountCredentials(id),
    queryKey: serviceAccountQueryKeys.credentials(id),
    retry: false,
  });

export const createServiceAccountMutationOptions = () =>
  mutationOptions({ mutationFn: createServiceAccount });

export const updateServiceAccountMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ body, id }: { body: ServiceAccountUpdateBody; id: string }) =>
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

export const createServiceAccountCredentialMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      body,
      id,
    }: {
      body: Parameters<typeof createServiceAccountCredential>[1];
      id: string;
    }) => createServiceAccountCredential(id, body),
  });

export const rotateServiceAccountCredentialMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      body,
      clientId,
      id,
    }: {
      body?: Parameters<typeof rotateServiceAccountCredential>[2];
      clientId: string;
      id: string;
    }) => rotateServiceAccountCredential(id, clientId, body),
  });

export const setServiceAccountCredentialStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({
      clientId,
      id,
      status,
    }: {
      clientId: string;
      id: string;
      status: "active" | "disabled";
    }) => setServiceAccountCredentialStatus(id, clientId, status),
  });

export const deleteServiceAccountCredentialMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ clientId, id }: { clientId: string; id: string }) =>
      deleteServiceAccountCredential(id, clientId),
  });

export { applicationQueryKeys, applicationsQueryOptions };

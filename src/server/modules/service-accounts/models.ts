import { t } from "elysia";

import { idSchema, ownerTypeSchema, resourceIdentifierSchema, type Owner } from "../models/common";

export const ServiceAccountModels = {
  ServiceAccountCreateBody: t.Object({
    name: t.String({ maxLength: 160, minLength: 1 }),
    description: t.Optional(t.String({ maxLength: 1000 })),
    ownerId: idSchema,
    ownerType: ownerTypeSchema,
  }),
  ServiceAccountUpdateBody: t.Object({
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
    description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
    ownerId: t.Optional(idSchema),
    ownerType: t.Optional(ownerTypeSchema),
  }),
  ServiceAccount: t.Object({
    id: idSchema,
    principalId: idSchema,
    name: t.String(),
    description: t.Nullable(t.String()),
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    owner: t.Ref("Owner"),
    createdAt: t.Number(),
    updatedAt: t.Number(),
  }),
  ServiceAccounts: t.Object({ serviceAccounts: t.Array(t.Ref("ServiceAccount")) }),
  ServiceAccountOwners: t.Object({
    teams: t.Array(t.Ref("OwnerCandidate")),
    users: t.Array(t.Ref("OwnerCandidate")),
  }),
  ServiceAccountStatus: t.Object({
    id: idSchema,
    principalId: idSchema,
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
  }),
  ServiceAccountCredentialCreateBody: t.Object({
    applicationId: idSchema,
    name: t.String({ maxLength: 160, minLength: 1 }),
  }),
  ServiceAccountCredentialRotateBody: t.Object({
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
  }),
  ServiceAccountCredential: t.Object({
    serviceAccountId: idSchema,
    applicationId: idSchema,
    applicationName: t.String(),
    resourceIdentifier: resourceIdentifierSchema,
    clientId: idSchema,
    name: t.String(),
    scopes: t.Array(t.String()),
    disabled: t.Boolean(),
    createdAt: t.Number(),
    updatedAt: t.Number(),
  }),
  ServiceAccountCredentialCreated: t.Intersect([
    t.Object({ clientSecret: t.String() }),
    t.Ref("ServiceAccountCredential"),
  ]),
  ServiceAccountCredentials: t.Object({ credentials: t.Array(t.Ref("ServiceAccountCredential")) }),
  ServiceAccountCredentialStatus: t.Object({
    clientId: idSchema,
    status: t.Union([t.Literal("active"), t.Literal("disabled"), t.Literal("deleted")]),
  }),
  ServiceAccountCredentialParams: t.Object({ id: idSchema, clientId: idSchema }),
} as const;

export type ServiceAccountCreateBody = typeof ServiceAccountModels.ServiceAccountCreateBody.static;
export type ServiceAccountUpdateBody = typeof ServiceAccountModels.ServiceAccountUpdateBody.static;
export type ServiceAccount = Omit<typeof ServiceAccountModels.ServiceAccount.static, "owner"> & {
  owner: Owner;
};
export type ServiceAccountOwners = typeof ServiceAccountModels.ServiceAccountOwners.static;
export type ServiceAccountCredentialCreateBody =
  typeof ServiceAccountModels.ServiceAccountCredentialCreateBody.static;
export type ServiceAccountCredentialRotateBody =
  typeof ServiceAccountModels.ServiceAccountCredentialRotateBody.static;
export type ServiceAccountCredential = typeof ServiceAccountModels.ServiceAccountCredential.static;
export type ServiceAccountCredentialCreated = ServiceAccountCredential & { clientSecret: string };
export type ServiceAccountCredentials =
  typeof ServiceAccountModels.ServiceAccountCredentials.static;
export type ServiceAccountCredentialStatus =
  typeof ServiceAccountModels.ServiceAccountCredentialStatus.static;

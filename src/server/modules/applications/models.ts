import { t } from "elysia";

import {
  emailSchema,
  idSchema,
  ownerTypeSchema,
  principalStatusSchema,
  resourceIdentifierSchema,
} from "../models/common";

const applicationStatusSchema = t.Union([t.Literal("active"), t.Literal("disabled")]);
const assignmentStatusSchema = t.Union([t.Literal("active"), t.Literal("suspended")]);
const applicationSubjectTypeSchema = t.Union([
  t.Literal("user"),
  t.Literal("service-account"),
  t.Literal("team"),
]);
const applicationClientTypeSchema = t.Union([t.Literal("public"), t.Literal("confidential")]);
const roleKeySchema = t.String({
  maxLength: 64,
  minLength: 1,
  pattern: "^[a-z0-9][a-z0-9._:-]*$",
});

export const ApplicationModels = {
  ApplicationCreateBody: t.Object({
    description: t.Optional(t.String({ maxLength: 1000 })),
    name: t.String({ maxLength: 160, minLength: 1 }),
    ownerId: idSchema,
    ownerType: ownerTypeSchema,
    resourceIdentifier: t.Optional(resourceIdentifierSchema),
  }),
  ApplicationUpdateBody: t.Object({
    description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
  }),
  Application: t.Object({
    id: idSchema,
    name: t.String(),
    description: t.Nullable(t.String()),
    status: applicationStatusSchema,
    resourceIdentifier: resourceIdentifierSchema,
    owner: t.Ref("Owner"),
    authzVersion: t.Integer({ minimum: 1 }),
    roleCount: t.Integer({ minimum: 0 }),
    assignmentCount: t.Integer({ minimum: 0 }),
    clientCount: t.Integer({ minimum: 0 }),
    createdAt: t.Number(),
    updatedAt: t.Number(),
  }),
  Applications: t.Object({ applications: t.Array(t.Ref("Application")) }),
  ApplicationStatus: t.Object({
    id: idSchema,
    status: applicationStatusSchema,
  }),
  ApplicationDeleted: t.Object({ id: idSchema, status: t.Literal("deleted") }),
  ApplicationOwners: t.Object({
    teams: t.Array(t.Ref("OwnerCandidate")),
    users: t.Array(t.Ref("OwnerCandidate")),
  }),
  ApplicationRoleCreateBody: t.Object({
    description: t.Optional(t.String({ maxLength: 1000 })),
    key: roleKeySchema,
    name: t.String({ maxLength: 160, minLength: 1 }),
  }),
  ApplicationRoleUpdateBody: t.Object({
    description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
    status: t.Optional(t.Union([t.Literal("active"), t.Literal("disabled")])),
  }),
  ApplicationRole: t.Object({
    id: idSchema,
    applicationId: idSchema,
    key: roleKeySchema,
    name: t.String(),
    description: t.Nullable(t.String()),
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    grantCount: t.Integer({ minimum: 0 }),
    createdAt: t.Number(),
    updatedAt: t.Number(),
  }),
  ApplicationRoles: t.Object({ roles: t.Array(t.Ref("ApplicationRole")) }),
  ApplicationRoleParams: t.Object({ id: idSchema, roleKey: roleKeySchema }),
  ApplicationRoleStatus: t.Object({ id: idSchema, status: t.Union([t.Literal("deleted")]) }),
  ApplicationAssignmentBody: t.Object({
    status: t.Optional(assignmentStatusSchema),
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
  }),
  ApplicationAssignmentParams: t.Object({
    id: idSchema,
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
  }),
  ApplicationAssignment: t.Object({
    applicationId: idSchema,
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
    status: assignmentStatusSchema,
  }),
  ApplicationAssignmentResult: t.Object({
    applicationId: idSchema,
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
    status: t.Union([assignmentStatusSchema, t.Literal("removed")]),
  }),
  ApplicationRoleGrantBody: t.Object({
    roleKey: roleKeySchema,
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
  }),
  ApplicationRoleGrantParams: t.Object({
    id: idSchema,
    roleKey: roleKeySchema,
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
  }),
  ApplicationRoleGrant: t.Object({
    applicationId: idSchema,
    roleKey: roleKeySchema,
    subjectId: idSchema,
    subjectType: applicationSubjectTypeSchema,
    status: t.Union([t.Literal("granted"), t.Literal("revoked")]),
  }),
  ApplicationRoleOrigin: t.Object({
    kind: t.Union([t.Literal("direct"), t.Literal("team")]),
    roleKey: roleKeySchema,
    teamId: t.Optional(idSchema),
    teamName: t.Optional(t.String()),
  }),
  ApplicationUserAccess: t.Object({
    id: idSchema,
    principalId: idSchema,
    name: t.String(),
    email: emailSchema,
    status: principalStatusSchema,
    assignmentStatus: t.Nullable(assignmentStatusSchema),
    directRoles: t.Array(roleKeySchema),
    teamRoles: t.Array(t.Ref("ApplicationRoleOrigin")),
    effectiveRoles: t.Array(roleKeySchema),
  }),
  ApplicationServiceAccountAccess: t.Object({
    id: idSchema,
    principalId: idSchema,
    name: t.String(),
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    assignmentStatus: t.Nullable(assignmentStatusSchema),
    directRoles: t.Array(roleKeySchema),
    effectiveRoles: t.Array(roleKeySchema),
  }),
  ApplicationTeamAccess: t.Object({
    id: idSchema,
    name: t.String(),
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    assignmentStatus: t.Nullable(assignmentStatusSchema),
    directRoles: t.Array(roleKeySchema),
  }),
  ApplicationAccess: t.Object({
    applicationId: idSchema,
    users: t.Array(t.Ref("ApplicationUserAccess")),
    serviceAccounts: t.Array(t.Ref("ApplicationServiceAccountAccess")),
    teams: t.Array(t.Ref("ApplicationTeamAccess")),
  }),
  ApplicationClientCreateBody: t.Object({
    clientType: applicationClientTypeSchema,
    name: t.String({ maxLength: 160, minLength: 1 }),
    redirectUris: t.Array(t.String({ format: "uri", maxLength: 2048, minLength: 1 }), {
      maxItems: 32,
    }),
    scopes: t.Array(t.String({ maxLength: 64, minLength: 1 }), { maxItems: 4 }),
  }),
  ApplicationClientUpdateBody: t.Object({
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
    redirectUris: t.Optional(
      t.Array(t.String({ format: "uri", maxLength: 2048, minLength: 1 }), { maxItems: 32 }),
    ),
    scopes: t.Optional(t.Array(t.String({ maxLength: 64, minLength: 1 }), { maxItems: 4 })),
  }),
  ApplicationClient: t.Object({
    applicationId: idSchema,
    clientId: idSchema,
    clientType: applicationClientTypeSchema,
    name: t.String(),
    redirectUris: t.Array(t.String()),
    scopes: t.Array(t.String()),
    disabled: t.Boolean(),
    createdAt: t.Number(),
    updatedAt: t.Number(),
  }),
  ApplicationClientCreated: t.Intersect([
    t.Object({
      clientSecret: t.Nullable(t.String()),
    }),
    t.Ref("ApplicationClient"),
  ]),
  ApplicationClients: t.Object({ clients: t.Array(t.Ref("ApplicationClient")) }),
  ApplicationClientStatus: t.Object({ clientId: idSchema, status: t.Literal("deleted") }),
  ApplicationClientParams: t.Object({ id: idSchema, clientId: idSchema }),
} as const;

export type Application = typeof ApplicationModels.Application.static;
export type ApplicationOwners = typeof ApplicationModels.ApplicationOwners.static;
export type ApplicationCreateBody = typeof ApplicationModels.ApplicationCreateBody.static;
export type ApplicationUpdateBody = typeof ApplicationModels.ApplicationUpdateBody.static;
export type ApplicationRole = typeof ApplicationModels.ApplicationRole.static;
export type ApplicationRoles = typeof ApplicationModels.ApplicationRoles.static;
export type ApplicationRoleCreateBody = typeof ApplicationModels.ApplicationRoleCreateBody.static;
export type ApplicationRoleUpdateBody = typeof ApplicationModels.ApplicationRoleUpdateBody.static;
export type ApplicationAssignmentBody = typeof ApplicationModels.ApplicationAssignmentBody.static;
export type ApplicationAssignment = typeof ApplicationModels.ApplicationAssignment.static;
export type ApplicationAssignmentResult =
  typeof ApplicationModels.ApplicationAssignmentResult.static;
export type ApplicationRoleGrantBody = typeof ApplicationModels.ApplicationRoleGrantBody.static;
export type ApplicationRoleGrant = typeof ApplicationModels.ApplicationRoleGrant.static;
export type ApplicationClientCreateBody =
  typeof ApplicationModels.ApplicationClientCreateBody.static;
export type ApplicationClientUpdateBody =
  typeof ApplicationModels.ApplicationClientUpdateBody.static;
export type ApplicationClient = typeof ApplicationModels.ApplicationClient.static;
export type ApplicationClientCreated = typeof ApplicationModels.ApplicationClientCreated.static;
export type ApplicationClients = typeof ApplicationModels.ApplicationClients.static;
export type ApplicationAccess = typeof ApplicationModels.ApplicationAccess.static;

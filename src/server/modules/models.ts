import { t } from "elysia";

const emailSchema = t.String({ format: "email", maxLength: 320, minLength: 3 });
const tokenSchema = t.String({ maxLength: 1024, minLength: 1 });
const idSchema = t.String({ maxLength: 256, minLength: 1 });

const bootstrapStatusSchema = t.Union([
  t.Literal("uninitialized"),
  t.Literal("reserved"),
  t.Literal("user-created"),
  t.Literal("completed"),
]);

const emailMessageSchema = t.Object({
  email: emailSchema,
  kind: t.Union([t.Literal("invitation"), t.Literal("password-reset"), t.Literal("verification")]),
  token: t.String(),
  url: t.String({ format: "uri" }),
});

const ownerTypeSchema = t.Union([t.Literal("user"), t.Literal("team")]);
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
const resourceIdentifierSchema = t.String({ format: "uri", maxLength: 2048, minLength: 1 });
const principalStatusSchema = t.Union([
  t.Literal("active"),
  t.Literal("disabled"),
  t.Literal("unmanaged"),
]);

export const ApiModels = {
  Error: t.Object({ error: t.String() }),

  BootstrapTokenBody: t.Object({
    bootstrapToken: t.Optional(tokenSchema),
    token: t.Optional(tokenSchema),
  }),
  BootstrapCompleteBody: t.Object({
    bootstrapToken: t.Optional(tokenSchema),
    email: emailSchema,
    name: t.String({ maxLength: 160, minLength: 1 }),
    password: t.String({ maxLength: 256, minLength: 8 }),
    reservationId: t.Optional(idSchema),
    token: t.Optional(tokenSchema),
  }),
  InvitationCreateBody: t.Object({
    email: emailSchema,
    expiresIn: t.Optional(t.Integer({ maximum: 60 * 60 * 24 * 30, minimum: 1 })),
    expiresInSeconds: t.Optional(t.Integer({ maximum: 60 * 60 * 24 * 30, minimum: 1 })),
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
    systemRoleKeys: t.Optional(t.Array(t.String({ maxLength: 64, minLength: 1 }), { maxItems: 3 })),
  }),
  InvitationAcceptBody: t.Object({
    email: t.Optional(emailSchema),
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
    password: t.String({ maxLength: 256, minLength: 8 }),
  }),
  TokenParams: t.Object({ token: tokenSchema }),
  UserParams: t.Object({ id: idSchema }),

  BootstrapStatus: t.Object({
    available: t.Literal(true),
    status: bootstrapStatusSchema,
  }),
  BootstrapReservation: t.Object({
    reservationId: idSchema,
    status: bootstrapStatusSchema,
  }),
  BootstrapComplete: t.Object({
    principalId: t.Optional(idSchema),
    status: t.Literal("completed"),
    userId: t.Nullable(idSchema),
  }),
  EmailMessage: emailMessageSchema,
  EmailSink: t.Object({
    messages: t.Array(emailMessageSchema),
  }),
  InvitationCreated: t.Object({
    deliveryPending: t.Boolean(),
    email: emailSchema,
    expiresAt: t.Number(),
    id: idSchema,
    token: tokenSchema,
  }),
  InvitationPublic: t.Object({
    email: emailSchema,
    expiresAt: t.Number(),
    name: t.Nullable(t.String()),
    status: t.Union([t.Literal("pending"), t.Literal("claimed")]),
  }),
  InvitationAccepted: t.Object({
    email: emailSchema,
    principalId: idSchema,
    status: t.Literal("accepted"),
    userId: idSchema,
  }),
  InvitationRevoked: t.Object({
    id: idSchema,
    status: t.Literal("revoked"),
  }),
  UserStatus: t.Object({
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    userId: idSchema,
  }),
  AdminAccess: t.Object({ permissions: t.Array(t.String()) }),

  IdentifierParams: t.Object({ id: idSchema }),
  TeamMemberParams: t.Object({ id: idSchema, userId: idSchema }),
  UserRoleParams: t.Object({ id: idSchema, roleKey: idSchema }),
  User: t.Object({
    id: idSchema,
    principalId: t.Nullable(idSchema),
    name: t.String(),
    email: emailSchema,
    emailVerified: t.Boolean(),
    status: principalStatusSchema,
    humanStatus: t.Nullable(t.Union([t.Literal("active"), t.Literal("disabled")])),
    disabled: t.Boolean(),
    roles: t.Array(t.String()),
    teams: t.Array(
      t.Object({
        id: idSchema,
        name: t.String(),
        status: t.Union([t.Literal("active"), t.Literal("disabled")]),
      }),
    ),
    createdAt: t.Number(),
  }),
  Users: t.Object({ users: t.Array(t.Ref("User")) }),
  UserRepair: t.Object({
    principalId: idSchema,
    status: t.Union([t.Literal("active"), t.Literal("repaired")]),
    userId: idSchema,
  }),
  SystemRole: t.Object({
    key: idSchema,
    name: t.String(),
    description: t.String(),
    activeGrantCount: t.Integer({ minimum: 0 }),
  }),
  SystemRoles: t.Object({ roles: t.Array(t.Ref("SystemRole")) }),
  SystemRoleGrantBody: t.Object({ roleKey: idSchema }),
  SystemRoleGrant: t.Object({
    principalId: idSchema,
    roleKey: idSchema,
    status: t.Union([t.Literal("granted"), t.Literal("revoked")]),
    userId: idSchema,
  }),
  Owner: t.Object({ id: idSchema, label: t.String(), type: ownerTypeSchema }),
  OwnerCandidate: t.Object({ id: idSchema, name: t.String() }),
  OwnershipBody: t.Object({ ownerId: idSchema, ownerType: ownerTypeSchema }),
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
  TeamCreateBody: t.Object({
    name: t.String({ maxLength: 160, minLength: 1 }),
    description: t.Optional(t.String({ maxLength: 1000 })),
  }),
  TeamUpdateBody: t.Object({
    name: t.Optional(t.String({ maxLength: 160, minLength: 1 })),
    description: t.Optional(t.Nullable(t.String({ maxLength: 1000 }))),
  }),
  TeamMemberBody: t.Object({ userId: idSchema }),
  Team: t.Object({
    id: idSchema,
    name: t.String(),
    description: t.Nullable(t.String()),
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    memberCount: t.Integer({ minimum: 0 }),
    members: t.Array(
      t.Object({
        id: idSchema,
        principalId: idSchema,
        name: t.String(),
        email: emailSchema,
      }),
    ),
    createdAt: t.Number(),
    updatedAt: t.Number(),
  }),
  Teams: t.Object({ teams: t.Array(t.Ref("Team")) }),
  TeamCreated: t.Object({
    id: idSchema,
    name: t.String(),
    description: t.Nullable(t.String()),
    status: t.Literal("active"),
  }),
  TeamStatus: t.Object({
    id: idSchema,
    status: t.Union([t.Literal("active"), t.Literal("disabled"), t.Literal("deleted")]),
  }),
  TeamMember: t.Object({
    teamId: idSchema,
    principalId: idSchema,
    status: t.Union([t.Literal("member"), t.Literal("removed")]),
  }),
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

export type BootstrapTokenBody = typeof ApiModels.BootstrapTokenBody.static;
export type BootstrapCompleteBody = typeof ApiModels.BootstrapCompleteBody.static;
export type InvitationCreateBody = typeof ApiModels.InvitationCreateBody.static;
export type InvitationAcceptBody = typeof ApiModels.InvitationAcceptBody.static;
export type BootstrapStatus = (typeof ApiModels.BootstrapStatus.static)["status"];
export type BootstrapStatusResponse = typeof ApiModels.BootstrapStatus.static;
export type BootstrapReservation = typeof ApiModels.BootstrapReservation.static;
export type BootstrapComplete = typeof ApiModels.BootstrapComplete.static;
export type InvitationCreated = typeof ApiModels.InvitationCreated.static;
export type InvitationPublic = typeof ApiModels.InvitationPublic.static;
export type InvitationAccepted = typeof ApiModels.InvitationAccepted.static;
export type AdminAccess = typeof ApiModels.AdminAccess.static;
export type User = typeof ApiModels.User.static;
export type SystemRole = typeof ApiModels.SystemRole.static;
export type Owner = typeof ApiModels.Owner.static;
export type ServiceAccount = Omit<typeof ApiModels.ServiceAccount.static, "owner"> & {
  owner: Owner;
};
export type OwnerCandidate = typeof ApiModels.OwnerCandidate.static;
export type ServiceAccountOwners = typeof ApiModels.ServiceAccountOwners.static;
export type Team = typeof ApiModels.Team.static;
export type ServiceAccountCreateBody = typeof ApiModels.ServiceAccountCreateBody.static;
export type ServiceAccountUpdateBody = typeof ApiModels.ServiceAccountUpdateBody.static;
export type OwnershipBody = typeof ApiModels.OwnershipBody.static;
export type TeamCreateBody = typeof ApiModels.TeamCreateBody.static;
export type TeamUpdateBody = typeof ApiModels.TeamUpdateBody.static;
export type TeamMemberBody = typeof ApiModels.TeamMemberBody.static;
export type Application = typeof ApiModels.Application.static;
export type ApplicationOwners = typeof ApiModels.ApplicationOwners.static;
export type ApplicationCreateBody = typeof ApiModels.ApplicationCreateBody.static;
export type ApplicationUpdateBody = typeof ApiModels.ApplicationUpdateBody.static;
export type ApplicationRole = typeof ApiModels.ApplicationRole.static;
export type ApplicationRoles = typeof ApiModels.ApplicationRoles.static;
export type ApplicationRoleCreateBody = typeof ApiModels.ApplicationRoleCreateBody.static;
export type ApplicationRoleUpdateBody = typeof ApiModels.ApplicationRoleUpdateBody.static;
export type ApplicationAssignmentBody = typeof ApiModels.ApplicationAssignmentBody.static;
export type ApplicationAssignment = typeof ApiModels.ApplicationAssignment.static;
export type ApplicationAssignmentResult = typeof ApiModels.ApplicationAssignmentResult.static;
export type ApplicationRoleGrantBody = typeof ApiModels.ApplicationRoleGrantBody.static;
export type ApplicationRoleGrant = typeof ApiModels.ApplicationRoleGrant.static;
export type ApplicationClientCreateBody = typeof ApiModels.ApplicationClientCreateBody.static;
export type ApplicationClientUpdateBody = typeof ApiModels.ApplicationClientUpdateBody.static;
export type ApplicationClient = typeof ApiModels.ApplicationClient.static;
export type ApplicationClientCreated = typeof ApiModels.ApplicationClientCreated.static;
export type ApplicationClients = typeof ApiModels.ApplicationClients.static;
export type ApplicationAccess = typeof ApiModels.ApplicationAccess.static;

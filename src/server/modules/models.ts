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

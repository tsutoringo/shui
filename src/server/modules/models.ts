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

export const M1Models = {
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
} as const;

export type BootstrapTokenBody = typeof M1Models.BootstrapTokenBody.static;
export type BootstrapCompleteBody = typeof M1Models.BootstrapCompleteBody.static;
export type InvitationCreateBody = typeof M1Models.InvitationCreateBody.static;
export type InvitationAcceptBody = typeof M1Models.InvitationAcceptBody.static;
export type BootstrapStatus = (typeof M1Models.BootstrapStatus.static)["status"];
export type BootstrapStatusResponse = typeof M1Models.BootstrapStatus.static;
export type BootstrapReservation = typeof M1Models.BootstrapReservation.static;
export type BootstrapComplete = typeof M1Models.BootstrapComplete.static;
export type InvitationCreated = typeof M1Models.InvitationCreated.static;
export type InvitationPublic = typeof M1Models.InvitationPublic.static;
export type InvitationAccepted = typeof M1Models.InvitationAccepted.static;

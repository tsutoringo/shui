import { t } from "elysia";

import { emailSchema, idSchema, tokenSchema } from "../models/common";

export const InvitationModels = {
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
} as const;

export type InvitationCreateBody = typeof InvitationModels.InvitationCreateBody.static;
export type InvitationAcceptBody = typeof InvitationModels.InvitationAcceptBody.static;
export type InvitationCreated = typeof InvitationModels.InvitationCreated.static;
export type InvitationPublic = typeof InvitationModels.InvitationPublic.static;
export type InvitationAccepted = typeof InvitationModels.InvitationAccepted.static;

import { t } from "elysia";

import { emailSchema, idSchema, tokenSchema } from "../models/common";

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

export const BootstrapModels = {
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
} as const;

export type BootstrapTokenBody = typeof BootstrapModels.BootstrapTokenBody.static;
export type BootstrapCompleteBody = typeof BootstrapModels.BootstrapCompleteBody.static;
export type BootstrapStatus = (typeof BootstrapModels.BootstrapStatus.static)["status"];
export type BootstrapStatusResponse = typeof BootstrapModels.BootstrapStatus.static;
export type BootstrapReservation = typeof BootstrapModels.BootstrapReservation.static;
export type BootstrapComplete = typeof BootstrapModels.BootstrapComplete.static;

import { t } from "elysia";

import { emailSchema, idSchema } from "../models/common";

export const TeamModels = {
  TeamMemberParams: t.Object({ id: idSchema, userId: idSchema }),
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

export type TeamCreateBody = typeof TeamModels.TeamCreateBody.static;
export type TeamUpdateBody = typeof TeamModels.TeamUpdateBody.static;
export type TeamMemberBody = typeof TeamModels.TeamMemberBody.static;
export type Team = typeof TeamModels.Team.static;

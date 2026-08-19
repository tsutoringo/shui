import { t } from "elysia";

import { emailSchema, idSchema, principalStatusSchema } from "../models/common";

export const UserModels = {
  UserParams: t.Object({ id: idSchema }),
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
  UserStatus: t.Object({
    status: t.Union([t.Literal("active"), t.Literal("disabled")]),
    userId: idSchema,
  }),
} as const;

export type User = typeof UserModels.User.static;

import { t } from "elysia";

import { idSchema } from "../models/common";

export const SystemRoleModels = {
  UserRoleParams: t.Object({ id: idSchema, roleKey: idSchema }),
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
} as const;

export type SystemRole = typeof SystemRoleModels.SystemRole.static;

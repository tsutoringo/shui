import { t } from "elysia";

export const AuthorizationModels = {
  AdminAccess: t.Object({ permissions: t.Array(t.String()) }),
} as const;

export type AdminAccess = typeof AuthorizationModels.AdminAccess.static;

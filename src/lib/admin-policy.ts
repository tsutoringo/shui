import type { AdminAccess } from "../server/modules/models";

export const adminRoutePermissions = {
  applications: "applications:read",
  serviceAccounts: "service-accounts:read",
  systemRoles: "system-roles:read",
  teams: "teams:read",
  users: "users:read",
} as const;

export type AdminRoutePermission =
  (typeof adminRoutePermissions)[keyof typeof adminRoutePermissions];

export function hasAdminPermission(access: AdminAccess | undefined, permission: string) {
  return Boolean(access?.permissions.includes("*") || access?.permissions.includes(permission));
}

export function firstAdminPath(access: AdminAccess) {
  if (hasAdminPermission(access, adminRoutePermissions.users)) return "/admin/users" as const;
  if (hasAdminPermission(access, adminRoutePermissions.teams)) return "/admin/teams" as const;
  if (hasAdminPermission(access, adminRoutePermissions.applications)) {
    return "/admin/applications" as const;
  }
  if (hasAdminPermission(access, adminRoutePermissions.serviceAccounts)) {
    return "/admin/service-accounts" as const;
  }
  if (hasAdminPermission(access, adminRoutePermissions.systemRoles)) {
    return "/admin/system-roles" as const;
  }
  return "/admin/users" as const;
}

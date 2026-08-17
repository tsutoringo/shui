import { describe, expect, it } from "vite-plus/test";

import { firstAdminPath, hasAdminPermission } from "../src/lib/admin-policy";
import type { AdminAccess } from "../src/server/modules/models";

function access(permissions: string[]): AdminAccess {
  return { permissions };
}

describe("admin policy", () => {
  it("treats root as having every admin permission", () => {
    expect(hasAdminPermission(access(["*"]), "users:read")).toBe(true);
    expect(hasAdminPermission(access(["*"]), "service-accounts:write")).toBe(true);
  });

  it("keeps application administration separate from user administration", () => {
    const applicationAdmin = access([
      "owners:read",
      "service-accounts:read",
      "service-accounts:write",
    ]);

    expect(hasAdminPermission(applicationAdmin, "service-accounts:read")).toBe(true);
    expect(hasAdminPermission(applicationAdmin, "users:read")).toBe(false);
    expect(firstAdminPath(applicationAdmin)).toBe("/admin/service-accounts");
  });

  it("chooses a usable landing page for each built-in administrator role", () => {
    expect(firstAdminPath(access(["users:read"]))).toBe("/admin/users");
    expect(firstAdminPath(access(["teams:read"]))).toBe("/admin/teams");
    expect(firstAdminPath(access(["system-roles:read"]))).toBe("/admin/system-roles");
    expect(firstAdminPath(access(["*"]))).toBe("/admin/users");
  });

  it("denies missing access data", () => {
    expect(hasAdminPermission(undefined, "users:read")).toBe(false);
  });
});

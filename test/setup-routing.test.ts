import { describe, expect, it } from "vite-plus/test";

import { getSetupRedirect } from "../src/features/bootstrap/routing";

describe("setup routing", () => {
  it("redirects every non-setup UI route while bootstrap is incomplete", () => {
    expect(getSetupRedirect("/", 200, true)).toBe("/setup");
    expect(getSetupRedirect("/sign-in", 200, true)).toBe("/setup");
    expect(getSetupRedirect("/invite/example", 200, true)).toBe("/setup");
  });

  it("keeps setup available while bootstrap is incomplete", () => {
    expect(getSetupRedirect("/setup", 200, true)).toBeUndefined();
    expect(getSetupRedirect("/setup/", 200, true)).toBeUndefined();
  });

  it("does not redirect initialized routes and leaves setup after completion", () => {
    expect(getSetupRedirect("/", 404, false)).toBeUndefined();
    expect(getSetupRedirect("/sign-in", 404, false)).toBeUndefined();
    expect(getSetupRedirect("/setup", 404, false)).toBe("/sign-in");
  });
});

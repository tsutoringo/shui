import { describe, expect, it } from "vite-plus/test";

import { parseRouterSearch, stringifyRouterSearch } from "../src/shared/routing/search-params";

describe("router search parameters", () => {
  it("preserves repeated OAuth signature parameter names", () => {
    const original = new URLSearchParams([
      ["client_id", "client-example"],
      ["exp", "1787017639"],
      ["ba_param", "client_id"],
      ["ba_param", "exp"],
      ["ba_param", "ba_param"],
      ["sig", "signed-value"],
    ]).toString();

    const serialized = stringifyRouterSearch(parseRouterSearch(original));
    const restored = new URLSearchParams(serialized);

    expect(restored.getAll("ba_param")).toEqual(["client_id", "exp", "ba_param"]);
    expect(canonicalize(restored)).toBe(canonicalize(new URLSearchParams(original)));
  });

  it("keeps OAuth JSON values as literal strings", () => {
    const claims = JSON.stringify({ userinfo: { email: null } });
    const parsed = parseRouterSearch(`claims=${encodeURIComponent(claims)}`);

    expect(parsed.claims).toBe(claims);
    expect(new URLSearchParams(stringifyRouterSearch(parsed)).get("claims")).toBe(claims);
  });
});

function canonicalize(params: URLSearchParams) {
  return [...params.entries()]
    .sort(
      ([keyA, valueA], [keyB, valueB]) => keyA.localeCompare(keyB) || valueA.localeCompare(valueB),
    )
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";

import { healthQueryOptions } from "../src/shared/queries/health-query";

describe("shared query options", () => {
  it("stores health data in the shared query cache", async () => {
    const queryClient = new QueryClient();
    const health = await queryClient.ensureQueryData(healthQueryOptions);

    expect(health).toEqual({ service: "shui-api", status: "ok" });
    expect(queryClient.getQueryData(healthQueryOptions.queryKey)).toEqual(health);
  });
});

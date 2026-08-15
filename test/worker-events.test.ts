import {
  createExecutionContext,
  createMessageBatch,
  createScheduledController,
  getQueueResult,
} from "cloudflare:test";
import { describe, expect, it } from "vite-plus/test";

import { handleQueue, handleScheduled } from "../src/worker-events";

describe("Worker event handlers", () => {
  it("explicitly acknowledges every queue message", async () => {
    const batch = createMessageBatch("shui-provisioning", [
      { attempts: 1, body: { id: "one" }, id: "one", timestamp: new Date() },
      { attempts: 1, body: { id: "two" }, id: "two", timestamp: new Date() },
    ]);
    const context = createExecutionContext();

    handleQueue(batch);

    await expect(getQueueResult(batch, context)).resolves.toMatchObject({
      ackAll: false,
      explicitAcks: ["one", "two"],
      retryMessages: [],
    });
  });

  it("accepts a scheduled controller in the Workers runtime", () => {
    expect(() =>
      handleScheduled(createScheduledController({ cron: "*/15 * * * *" })),
    ).not.toThrow();
  });
});

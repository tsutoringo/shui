import startHandler from "@tanstack/react-start/server-entry";

import { handleRootOAuthAuthorizationServerMetadata } from "./server/metadata";
import { handleQueue, handleScheduled } from "./worker-events";

const worker = {
  async fetch(request: Request, env: Env) {
    const metadataResponse = await handleRootOAuthAuthorizationServerMetadata(request, env);
    return metadataResponse ?? startHandler.fetch(request);
  },

  queue(batch: MessageBatch<unknown>) {
    handleQueue(batch);
  },

  scheduled(controller: ScheduledController) {
    handleScheduled(controller);
  },
};

export default worker;

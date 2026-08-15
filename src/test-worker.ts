import { createApiApp } from "./server/api";
import { handleRootOAuthAuthorizationServerMetadata } from "./server/metadata";

const worker = {
  async fetch(request: Request, env: Env) {
    const metadataResponse = await handleRootOAuthAuthorizationServerMetadata(request, env);
    return metadataResponse ?? createApiApp(env).fetch(request);
  },
};

export default worker;

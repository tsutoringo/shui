import { shuiApi } from "./server/api";
import { handleRootOAuthAuthorizationServerMetadata } from "./server/metadata";

const worker = {
  async fetch(request: Request, env: Env) {
    const metadataResponse = await handleRootOAuthAuthorizationServerMetadata(request, env);
    return metadataResponse ?? shuiApi.fetch(request);
  },
};

export default worker;

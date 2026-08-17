import { Elysia } from "elysia";

import { type AuthEnvironment, type AuthInstance } from "../auth";
import { createAuthorizationPlugin } from "./authorization/plugin";
import { ApiModels } from "./models";

export function createDomainApiRoutes(
  environment: AuthEnvironment,
  auth: AuthInstance,
  name: string,
) {
  return new Elysia({ name: `shui-${name}-routes`, normalize: false })
    .use(createAuthorizationPlugin(environment, auth))
    .model(ApiModels);
}

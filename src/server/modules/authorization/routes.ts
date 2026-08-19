import { createAuth } from "../../auth";
import { Elysia } from "elysia";

import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
import { AuthorizationModels } from "./models";
import { requireAdminAccess } from "./service";

export const authorizationRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...AuthorizationModels })
  .get(
    "/admin/access",
    ({ request, environment }) => requireAdminAccess(createAuth(environment), environment, request),
    {
      response: "AdminAccess",
    },
  );

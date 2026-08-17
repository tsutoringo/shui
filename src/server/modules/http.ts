import { type AuthEnvironment } from "../auth";
import { ApiError } from "./errors";

export function assertMutationOrigin(environment: AuthEnvironment, request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") throw new ApiError(403);

  const expectedOrigin = new URL(environment.BETTER_AUTH_URL).origin;
  const origin = request.headers.get("origin");
  if (origin && origin !== expectedOrigin) throw new ApiError(403);

  const referer = request.headers.get("referer");
  if (!origin && referer) {
    try {
      if (new URL(referer).origin !== expectedOrigin) throw new ApiError(403);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(403);
    }
  }
}

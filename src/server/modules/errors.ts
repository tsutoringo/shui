export const apiStatusCodes = [400, 401, 403, 404, 409, 429, 500] as const;

export type ApiStatusCode = (typeof apiStatusCodes)[number];

export class ApiError extends Error {
  readonly status: ApiStatusCode;

  constructor(readonly statusCode: ApiStatusCode) {
    super("The request could not be completed.");
    this.name = "ApiError";
    this.status = statusCode;
  }
}

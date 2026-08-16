export const m1StatusCodes = [400, 401, 403, 404, 409, 429, 500] as const;

export type M1StatusCode = (typeof m1StatusCodes)[number];

export class M1Error extends Error {
  readonly status: M1StatusCode;

  constructor(readonly statusCode: M1StatusCode) {
    super("The request could not be completed.");
    this.name = "M1Error";
    this.status = statusCode;
  }
}

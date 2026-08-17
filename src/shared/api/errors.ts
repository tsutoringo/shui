export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export function unwrapApiResponse<T>(response: { data: T | null; error: unknown; status: number }) {
  if (response.error || response.data === null) {
    throw new ApiClientError(readErrorMessage(response.error), response.status);
  }

  return response.data;
}

function readErrorMessage(value: unknown): string {
  if (value && typeof value === "object" && "value" in value) {
    return readErrorMessage(value.value);
  }

  if (value && typeof value === "object" && "error" in value && typeof value.error === "string") {
    return value.error;
  }

  return "The request could not be completed.";
}

export function formatApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    if (error.status === 401) return "Sign in with an administrator account to continue.";
    if (error.status === 403) return "Your system role does not allow this action.";
    if (error.status === 409) return "The change conflicts with the current identity state.";
    if (error.status === 429) return "Too many attempts. Wait a moment and try again.";
    return error.message;
  }

  return error instanceof Error && error.message
    ? error.message
    : "The request could not be completed.";
}

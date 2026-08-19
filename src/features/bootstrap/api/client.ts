import type {
  BootstrapComplete,
  BootstrapCompleteBody,
  BootstrapReservation,
  BootstrapTokenBody,
} from "~/server/modules/bootstrap/models";
import { getApiFetch } from "~/shared/api/eden-fetch";
import { unwrapApiResponse } from "~/shared/api/errors";

const emptyRequest = { body: {}, headers: {} } as const;

export type { BootstrapComplete, BootstrapReservation, BootstrapTokenBody };

export async function reserveBootstrap(body: BootstrapTokenBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/setup/reserve", { body, headers: {}, method: "POST" }),
  );
}

export async function completeBootstrap(body: BootstrapCompleteBody) {
  return unwrapApiResponse(
    await getApiFetch()("/api/setup/complete", { body, headers: {}, method: "POST" }),
  );
}

export async function getBootstrapStatus() {
  return unwrapApiResponse(
    await getApiFetch()("/api/setup/status", { ...emptyRequest, method: "GET" }),
  );
}

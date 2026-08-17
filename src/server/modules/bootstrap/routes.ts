import {
  type AuthEnvironment,
  type AuthInstance,
  isLocalEnvironment,
  readDevelopmentEmailSink,
} from "../../auth";
import { ApiError } from "../errors";
import { createDomainApiRoutes } from "../api-plugin";
import { completeBootstrap, completeSetup, getBootstrapStatus, reserveBootstrap } from "./service";

export function createBootstrapRoutes(environment: AuthEnvironment, auth: AuthInstance) {
  return createDomainApiRoutes(environment, auth, "bootstrap")
    .get(
      "/dev/email-sink",
      () => {
        if (!isLocalEnvironment(environment)) throw new ApiError(404);
        return { messages: [...readDevelopmentEmailSink()] };
      },
      { response: "EmailSink" },
    )
    .get("/bootstrap", () => getBootstrapStatus(environment), {
      response: "BootstrapStatus",
    })
    .get("/bootstrap/status", () => getBootstrapStatus(environment), {
      response: "BootstrapStatus",
    })
    .get("/setup", () => getBootstrapStatus(environment), {
      response: "BootstrapStatus",
    })
    .get("/setup/status", () => getBootstrapStatus(environment), {
      response: "BootstrapStatus",
    })
    .post("/bootstrap", ({ body, request }) => completeSetup(environment, auth, body, request), {
      body: "BootstrapCompleteBody",
      response: "BootstrapComplete",
    })
    .post("/setup", ({ body, request }) => completeSetup(environment, auth, body, request), {
      body: "BootstrapCompleteBody",
      response: "BootstrapComplete",
    })
    .post(
      "/bootstrap/reserve",
      ({ body, request }) => reserveBootstrap(environment, body, request),
      { body: "BootstrapTokenBody", response: "BootstrapReservation" },
    )
    .post("/setup/reserve", ({ body, request }) => reserveBootstrap(environment, body, request), {
      body: "BootstrapTokenBody",
      response: "BootstrapReservation",
    })
    .post(
      "/bootstrap/complete",
      ({ body, request }) => completeBootstrap(environment, auth, body, request),
      { body: "BootstrapCompleteBody", response: "BootstrapComplete" },
    )
    .post(
      "/setup/complete",
      ({ body, request }) => completeBootstrap(environment, auth, body, request),
      { body: "BootstrapCompleteBody", response: "BootstrapComplete" },
    );
}

import { createAuth, isLocalEnvironment, readDevelopmentEmailSink } from "../../auth";
import { Elysia } from "elysia";

import { ApiError } from "../errors";
import { CommonModels } from "../models/common";
import { shuiPlugin } from "../plugin";
import { completeBootstrap, completeSetup, getBootstrapStatus, reserveBootstrap } from "./service";
import { BootstrapModels } from "./models";

export const bootstrapRoute = new Elysia()
  .use(shuiPlugin)
  .model({ ...CommonModels, ...BootstrapModels })
  .get(
    "/dev/email-sink",
    ({ environment }) => {
      if (!isLocalEnvironment(environment)) throw new ApiError(404);
      return { messages: [...readDevelopmentEmailSink()] };
    },
    { response: "EmailSink" },
  )
  .get("/bootstrap", ({ environment }) => getBootstrapStatus(environment), {
    response: "BootstrapStatus",
  })
  .get("/bootstrap/status", ({ environment }) => getBootstrapStatus(environment), {
    response: "BootstrapStatus",
  })
  .get("/setup", ({ environment }) => getBootstrapStatus(environment), {
    response: "BootstrapStatus",
  })
  .get("/setup/status", ({ environment }) => getBootstrapStatus(environment), {
    response: "BootstrapStatus",
  })
  .post(
    "/bootstrap",
    ({ body, request, environment }) =>
      completeSetup(environment, createAuth(environment), body, request),
    {
      body: "BootstrapCompleteBody",
      response: "BootstrapComplete",
    },
  )
  .post(
    "/setup",
    ({ body, request, environment }) =>
      completeSetup(environment, createAuth(environment), body, request),
    {
      body: "BootstrapCompleteBody",
      response: "BootstrapComplete",
    },
  )
  .post(
    "/bootstrap/reserve",
    ({ body, request, environment }) => reserveBootstrap(environment, body, request),
    { body: "BootstrapTokenBody", response: "BootstrapReservation" },
  )
  .post(
    "/setup/reserve",
    ({ body, request, environment }) => reserveBootstrap(environment, body, request),
    {
      body: "BootstrapTokenBody",
      response: "BootstrapReservation",
    },
  )
  .post(
    "/bootstrap/complete",
    ({ body, request, environment }) =>
      completeBootstrap(environment, createAuth(environment), body, request),
    { body: "BootstrapCompleteBody", response: "BootstrapComplete" },
  )
  .post(
    "/setup/complete",
    ({ body, request, environment }) =>
      completeBootstrap(environment, createAuth(environment), body, request),
    { body: "BootstrapCompleteBody", response: "BootstrapComplete" },
  );

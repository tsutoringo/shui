import { Button, LayerCard } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

import { authClient } from "~/features/auth/api/auth-client";
import { preflightConsent, type ConsentAccessDecision } from "~/features/consent/api/client";

type PreflightState =
  | { status: "checking" }
  | { decision: ConsentAccessDecision; status: "ready" | "denied" }
  | { error: string; status: "error" };

export function ConsentPage({
  claimsQuery,
  clientId,
  scope,
}: Readonly<{
  claimsQuery?: string;
  clientId?: string;
  scope?: string;
}>) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [preflight, setPreflight] = useState<PreflightState>({ status: "checking" });
  const scopes = scope?.split(/\s+/).filter(Boolean) ?? [];
  const claims = readClaimNames(claimsQuery);

  useEffect(() => {
    let isMounted = true;

    void preflightConsent(window.location.search)
      .then((decision) => {
        if (!isMounted) return;
        setPreflight({ decision, status: decision.authorized ? "ready" : "denied" });
      })
      .catch((preflightError) => {
        if (!isMounted) return;
        setPreflight({
          error:
            preflightError instanceof Error
              ? preflightError.message
              : "We could not verify access to this application.",
          status: "error",
        });
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function submitConsent(accept: boolean) {
    setError(undefined);
    setIsPending(true);
    try {
      const result = await authClient.oauth2.consent({ accept });
      if (result.error) throw new Error(result.error.message || "The consent request failed.");
      const payload = result.data;
      const redirectUri =
        payload?.redirect === true && typeof payload.url === "string" ? payload.url : undefined;
      if (typeof redirectUri !== "string") throw new Error("The consent response was incomplete.");
      window.location.assign(redirectUri);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The consent request failed.");
      setIsPending(false);
    }
  }

  const applicationName =
    preflight.status !== "checking" && preflight.status !== "error"
      ? preflight.decision.application?.name
      : undefined;
  const applicationLabel = applicationName ?? clientId ?? "An application";
  const canRespond = preflight.status !== "checking";
  const canAllow = preflight.status === "ready";
  const heading =
    preflight.status === "denied" ? "Access is not available." : "Give access with confidence.";
  const cardHeading =
    preflight.status === "denied"
      ? "Access denied"
      : preflight.status === "error"
        ? "Unable to verify access"
        : `${applicationLabel} requests access`;

  return (
    <section
      aria-busy={preflight.status === "checking"}
      className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20"
    >
      <p className="text-sm font-medium uppercase text-(--tangerine)">Authorization</p>
      <h1 className="mt-4 font-display text-5xl font-semibold leading-none text-kumo-strong">
        {heading}
      </h1>
      <LayerCard className="mt-10 bg-kumo-elevated px-5 py-4 ring ring-kumo-line">
        <h2 className="text-2xl font-semibold text-kumo-strong">{cardHeading}</h2>
        <p className="mt-2 text-sm text-kumo-subtle">
          {preflight.status === "denied"
            ? "This request cannot continue with the current account access."
            : "Review the requested permissions before continuing."}
        </p>
        <div
          aria-atomic="true"
          aria-live="polite"
          className="mt-4 min-h-5 text-sm text-kumo-subtle"
          role="status"
        >
          {preflight.status === "checking"
            ? "Checking whether your account can access this application…"
            : ""}
        </div>
        <ul className="mt-6 space-y-3 text-sm text-kumo-default">
          {scopes.length > 0 ? (
            scopes.map((requestedScope) => (
              <li
                className="rounded-lg border border-kumo-hairline bg-kumo-recessed p-3"
                key={requestedScope}
              >
                {requestedScope}
              </li>
            ))
          ) : (
            <li className="rounded-lg border border-kumo-hairline bg-kumo-recessed p-3">
              No scopes were requested.
            </li>
          )}
        </ul>
        {claims.length > 0 ? (
          <>
            <p className="mt-6 text-sm font-medium text-kumo-strong">Requested OIDC claims</p>
            <ul className="mt-3 space-y-3 text-sm text-kumo-default">
              {claims.map((claim) => (
                <li
                  className="rounded-lg border border-kumo-hairline bg-kumo-recessed p-3"
                  key={claim}
                >
                  {claim}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {preflight.status === "denied" ? (
          <div className="mt-6 rounded-lg border border-kumo-danger p-4" role="alert">
            <p className="font-medium text-kumo-danger">You cannot authorize this application.</p>
            <p className="mt-2 text-sm text-kumo-default">
              {readDeniedMessage(preflight.decision, applicationLabel)}
            </p>
          </div>
        ) : null}
        {preflight.status === "error" ? (
          <p className="mt-6 text-sm text-kumo-danger" role="alert">
            {preflight.error}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm text-kumo-danger" role="alert">
            {error}
          </p>
        ) : null}
        {canRespond ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {canAllow ? (
              <Button
                aria-busy={isPending}
                className="text-sm transition-none"
                disabled={isPending}
                onClick={() => void submitConsent(true)}
                type="button"
                variant="primary"
              >
                Allow access
              </Button>
            ) : null}
            <Button
              className="w-full text-sm transition-none sm:w-auto"
              disabled={isPending}
              onClick={() => void submitConsent(false)}
              type="button"
              variant="ghost"
            >
              Cancel
            </Button>
          </div>
        ) : null}
      </LayerCard>
    </section>
  );
}

function readDeniedMessage(decision: ConsentAccessDecision, applicationLabel: string) {
  switch (decision.reason) {
    case "not_assigned":
      return `Your account is not assigned to ${applicationLabel}. Ask an administrator to grant you access before trying again.`;
    case "principal_disabled":
      return "Your Shui account is not active. Contact an administrator for help.";
    case "resource_mismatch":
      return "This authorization request targets a different Application resource.";
    case "client_disabled":
    case "application_disabled":
      return "This application is currently unavailable. Contact the application administrator.";
    default:
      return "Your account is not currently allowed to authorize this application.";
  }
}

function readClaimNames(value: string | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return Object.entries(parsed).flatMap(([target, targetClaims]) =>
      targetClaims && typeof targetClaims === "object"
        ? Object.keys(targetClaims).map((claim) => `${target}.${claim}`)
        : [],
    );
  } catch {
    return [];
  }
}

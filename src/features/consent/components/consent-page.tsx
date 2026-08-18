import { Button, LayerCard } from "@cloudflare/kumo";
import { useState } from "react";

import { authClient } from "~/features/auth/api/auth-client";

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
  const scopes = scope?.split(/\s+/).filter(Boolean) ?? [];
  const claims = readClaimNames(claimsQuery);

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

  return (
    <section className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm font-medium uppercase text-(--tangerine)">Authorization</p>
      <h1 className="mt-4 font-display text-5xl font-semibold leading-none text-kumo-strong">
        Give access with confidence.
      </h1>
      <LayerCard className="mt-10 bg-kumo-elevated px-5 py-4 ring ring-kumo-line">
        <h2 className="text-2xl font-semibold text-kumo-strong">
          {clientId ? `${clientId} requests access` : "An application requests access"}
        </h2>
        <p className="mt-2 text-sm text-kumo-subtle">
          Review the requested permissions before continuing.
        </p>
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
        {error ? (
          <p className="mt-4 text-sm text-kumo-danger" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
      </LayerCard>
    </section>
  );
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

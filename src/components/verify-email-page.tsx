import { LinkButton } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

import { formatClientError, m1Fetch } from "../lib/m1-client";
import { FormError, FormStatus, M1Layout } from "./m1-layout";

export function VerifyEmailPage({ token }: Readonly<{ token?: string }>) {
  const [isPending, setIsPending] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!token) {
      setError("This verification link is missing its token.");
      setIsPending(false);
      return;
    }

    let active = true;
    void m1Fetch("/auth/verify-email?token=" + encodeURIComponent(token), { method: "GET" }).then(
      () => {
        if (active) setIsPending(false);
      },
      (verifyError) => {
        if (!active) return;
        setError(formatClientError(verifyError));
        setIsPending(false);
      },
    );
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <M1Layout
      description="Email verification keeps account recovery and sign-in notices pointed at the right person."
      eyebrow="Verify email"
      title={
        isPending ? "Checking your link." : error ? "This link needs attention." : "Email verified."
      }
    >
      {isPending ? (
        <p className="text-sm text-kumo-subtle" role="status">
          Verifying...
        </p>
      ) : null}
      {error ? <FormError>{error}</FormError> : null}
      {!isPending && !error ? <FormStatus>Your email address is confirmed.</FormStatus> : null}
      {!isPending ? (
        <LinkButton className="mt-6 justify-center text-sm" href="/sign-in" variant="primary">
          Continue to sign in
        </LinkButton>
      ) : null}
    </M1Layout>
  );
}

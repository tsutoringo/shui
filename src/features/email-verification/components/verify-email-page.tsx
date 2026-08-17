import { LinkButton } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

import { AuthLayout, FormError, FormStatus } from "~/components/layouts/auth-layout";
import { formatAuthError, authFetch } from "~/features/auth/api/auth-api";

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
    void authFetch("/auth/verify-email?token=" + encodeURIComponent(token), { method: "GET" }).then(
      () => {
        if (active) setIsPending(false);
      },
      (verifyError) => {
        if (!active) return;
        setError(formatAuthError(verifyError));
        setIsPending(false);
      },
    );
    return () => {
      active = false;
    };
  }, [token]);

  return (
    <AuthLayout
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
    </AuthLayout>
  );
}

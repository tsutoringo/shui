import { Button, Input, LinkButton } from "@cloudflare/kumo";
import { useState } from "react";

import { formatAuthError, authFetch } from "../../lib/auth-api";
import { FormError, FormStatus, M1Layout } from "./m1-layout";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      await authFetch("/auth/request-password-reset", {
        body: JSON.stringify({ email, redirectTo: "/reset-password" }),
        method: "POST",
      });
      setSent(true);
    } catch (submitError) {
      setError(formatAuthError(submitError));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <M1Layout
      description="Enter your account email and we will send a time-limited reset link if the account exists."
      eyebrow="Account recovery"
      title="Get back in safely."
      footer={
        <p className="text-sm text-kumo-subtle">
          Remembered it?{" "}
          <LinkButton href="/sign-in" variant="ghost">
            Sign in
          </LinkButton>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        <h2 className="text-xl font-semibold text-kumo-strong">Reset password</h2>
        {sent ? (
          <FormStatus>If that address belongs to Shui, a reset link is on its way.</FormStatus>
        ) : (
          <>
            <Input
              autoComplete="email"
              className="text-sm transition-none"
              id="forgot-email"
              label="Email address"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
            {error ? <FormError>{error}</FormError> : null}
            <Button
              aria-busy={isPending}
              className="w-full justify-center text-sm transition-none"
              disabled={isPending}
              type="submit"
              variant="primary"
            >
              {isPending ? "Sending link..." : "Send reset link"}
            </Button>
          </>
        )}
      </form>
    </M1Layout>
  );
}

export function ResetPasswordPage({ token }: Readonly<{ token?: string }>) {
  const [password, setPassword] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);
    try {
      await authFetch("/auth/reset-password", {
        body: JSON.stringify({ newPassword: password, token }),
        method: "POST",
      });
      setCompleted(true);
    } catch (submitError) {
      setError(formatAuthError(submitError));
    } finally {
      setIsPending(false);
    }
  }

  return (
    <M1Layout
      description="Choose a new password. All existing sessions will be revoked after a successful reset."
      eyebrow="Account recovery"
      title="Set a new password."
    >
      {completed ? (
        <>
          <FormStatus>Password updated. Existing sessions were revoked.</FormStatus>
          <LinkButton className="mt-6 justify-center text-sm" href="/sign-in" variant="primary">
            Sign in with new password
          </LinkButton>
        </>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <Input
            autoComplete="new-password"
            className="text-sm transition-none"
            id="reset-password"
            label="New password"
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          {token ? null : <FormError>This reset link is missing its token.</FormError>}
          {error ? <FormError>{error}</FormError> : null}
          <Button
            aria-busy={isPending}
            className="w-full justify-center text-sm transition-none"
            disabled={isPending || !token}
            type="submit"
            variant="primary"
          >
            {isPending ? "Updating password..." : "Update password"}
          </Button>
        </form>
      )}
    </M1Layout>
  );
}

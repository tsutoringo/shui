import { Button, Input, LinkButton } from "@cloudflare/kumo";
import { useState } from "react";

import { completeBootstrap, formatClientError, reserveBootstrap } from "../lib/m1-client";
import { FormError, FormStatus, M1Layout } from "./m1-layout";

export function SetupPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [bootstrapToken, setBootstrapToken] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [completed, setCompleted] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setIsPending(true);

    try {
      const reservation = await reserveBootstrap({ bootstrapToken });
      await completeBootstrap({
        bootstrapToken,
        email,
        name,
        password,
        reservationId: reservation.reservationId,
      });
      setCompleted(true);
    } catch (submitError) {
      setError(formatClientError(submitError));
    } finally {
      setIsPending(false);
    }
  }

  if (completed) {
    return (
      <M1Layout
        description="The first administrator account is ready. Verify the address from the email, then sign in to start inviting your team."
        eyebrow="Setup complete"
        title="Your control plane has an owner."
      >
        <FormStatus>Verification email sent.</FormStatus>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LinkButton
            className="w-full justify-center text-sm sm:w-auto"
            href="/sign-in"
            variant="primary"
          >
            Go to sign in
          </LinkButton>
          <LinkButton className="w-full justify-center text-sm sm:w-auto" href="/" variant="ghost">
            Return home
          </LinkButton>
        </div>
      </M1Layout>
    );
  }

  return (
    <M1Layout
      description="Shui starts closed. Use the one-time bootstrap secret from your Worker environment to create the first root account."
      eyebrow="First run"
      title="Claim the first seat."
      footer={
        <p className="text-sm text-kumo-subtle">
          Already initialized?{" "}
          <LinkButton href="/sign-in" variant="ghost">
            Sign in
          </LinkButton>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={submit}>
        <div>
          <h2 className="text-xl font-semibold text-kumo-strong">Create root account</h2>
          <p className="mt-2 text-sm leading-6 text-kumo-subtle">
            This account can manage users and issue invitations.
          </p>
        </div>
        <Input
          autoComplete="name"
          className="text-sm transition-none"
          id="setup-name"
          label="Your name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <Input
          autoComplete="email"
          className="text-sm transition-none"
          id="setup-email"
          label="Email address"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <Input
          autoComplete="new-password"
          className="text-sm transition-none"
          id="setup-password"
          label="Password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        <Input
          autoComplete="one-time-code"
          className="text-sm transition-none"
          id="bootstrap-token"
          label="Bootstrap secret"
          onChange={(event) => setBootstrapToken(event.target.value)}
          required
          type="password"
          value={bootstrapToken}
        />
        <p className="text-xs leading-5 text-kumo-subtle">
          The secret is submitted over HTTPS and is never included in the setup URL.
        </p>
        {error ? <FormError>{error}</FormError> : null}
        <Button
          aria-busy={isPending}
          className="w-full justify-center text-sm transition-none"
          disabled={isPending}
          type="submit"
          variant="primary"
        >
          {isPending ? "Creating account..." : "Initialize Shui"}
        </Button>
      </form>
    </M1Layout>
  );
}

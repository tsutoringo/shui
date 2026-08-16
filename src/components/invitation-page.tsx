import { Button, Input, LinkButton } from "@cloudflare/kumo";
import { useEffect, useState } from "react";

import {
  acceptInvitation,
  formatClientError,
  getInvitation,
  type InvitationPublic,
} from "../lib/m1-client";
import { FormError, FormStatus, M1Layout } from "./m1-layout";

export function InvitationPage({ token }: Readonly<{ token: string }>) {
  const [invitation, setInvitation] = useState<InvitationPublic>();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string>();
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    let active = true;
    void getInvitation(token).then(
      (details) => {
        if (!active) return;
        setInvitation(details);
        setEmail(details.email);
        setName(details.name ?? "");
        setIsLoading(false);
      },
      (loadError) => {
        if (!active) return;
        setError(formatClientError(loadError));
        setIsLoading(false);
      },
    );
    return () => {
      active = false;
    };
  }, [token]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;
    setError(undefined);
    setIsPending(true);
    try {
      await acceptInvitation(token, { email, name, password });
      setAccepted(true);
    } catch (submitError) {
      setError(formatClientError(submitError));
    } finally {
      setIsPending(false);
    }
  }

  if (isLoading) {
    return (
      <M1Layout
        description="Checking the invitation and its expiry before showing the account form."
        eyebrow="Invitation"
        title="One moment."
      >
        <p className="text-sm text-kumo-subtle" role="status">
          Loading invitation...
        </p>
      </M1Layout>
    );
  }

  if (error && !invitation) {
    return (
      <M1Layout
        description="This invitation may be expired, revoked, or already used. Ask a Shui administrator for a new link."
        eyebrow="Invitation unavailable"
        title="This link is no longer active."
      >
        <FormError>{error}</FormError>
        <LinkButton className="mt-6 justify-center text-sm" href="/sign-in" variant="ghost">
          Go to sign in
        </LinkButton>
      </M1Layout>
    );
  }

  if (accepted) {
    return (
      <M1Layout
        description="Verify your email from the message we sent, then sign in with the password you chose."
        eyebrow="You are invited"
        title="Your seat is ready."
      >
        <FormStatus>Verification email sent to {email}.</FormStatus>
        <LinkButton className="mt-6 justify-center text-sm" href="/sign-in" variant="primary">
          Continue to sign in
        </LinkButton>
      </M1Layout>
    );
  }

  return (
    <M1Layout
      description="Create your Shui account from this single-use invitation. Your email is fixed by the administrator who invited you."
      eyebrow="You are invited"
      title="Join the control plane."
    >
      <form className="space-y-5" onSubmit={submit}>
        <div>
          <h2 className="text-xl font-semibold text-kumo-strong">Accept invitation</h2>
          <p className="mt-2 text-sm text-kumo-subtle">
            Invitation expires {new Date(invitation?.expiresAt ?? 0).toLocaleString()}.
          </p>
        </div>
        <Input
          autoComplete="email"
          className="text-sm transition-none"
          id="invitation-email"
          label="Email address"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
        <Input
          autoComplete="name"
          className="text-sm transition-none"
          id="invitation-name"
          label="Your name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <Input
          autoComplete="new-password"
          className="text-sm transition-none"
          id="invitation-password"
          label="Password"
          minLength={8}
          onChange={(event) => setPassword(event.target.value)}
          required
          type="password"
          value={password}
        />
        {error ? <FormError>{error}</FormError> : null}
        <Button
          aria-busy={isPending}
          className="w-full justify-center text-sm transition-none"
          disabled={isPending}
          type="submit"
          variant="primary"
        >
          {isPending ? "Creating account..." : "Accept invitation"}
        </Button>
      </form>
    </M1Layout>
  );
}

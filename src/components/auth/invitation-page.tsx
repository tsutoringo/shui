import { Button, Input, LinkButton } from "@cloudflare/kumo";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { formatApiError } from "../../lib/api-client";
import {
  acceptInvitationMutationOptions,
  invitationQueryOptions,
} from "../../lib/api-query-options";
import { FormError, FormStatus, M1Layout } from "./m1-layout";

export function InvitationPage({ token }: Readonly<{ token: string }>) {
  const invitationQuery = useQuery(invitationQueryOptions(token));
  const acceptMutation = useMutation(acceptInvitationMutationOptions());
  const invitation = invitationQuery.data;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!invitation) return;
    setEmail(invitation.email);
    setName(invitation.name ?? "");
  }, [invitation]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!invitation) return;
    setError(undefined);
    try {
      await acceptMutation.mutateAsync({ body: { email, name, password }, token });
      setAccepted(true);
    } catch (submitError) {
      setError(formatApiError(submitError));
    }
  }

  if (invitationQuery.isLoading) {
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

  if (invitationQuery.isError && !invitation) {
    return (
      <M1Layout
        description="This invitation may be expired, revoked, or already used. Ask a Shui administrator for a new link."
        eyebrow="Invitation unavailable"
        title="This link is no longer active."
      >
        <FormError>{formatApiError(invitationQuery.error)}</FormError>
        <LinkButton className="mt-6 justify-center text-sm" href="/sign-in" variant="ghost">
          Go to sign in
        </LinkButton>
      </M1Layout>
    );
  }

  if (accepted) {
    return (
      <M1Layout
        description="Your account is ready. Sign in with the password you chose."
        eyebrow="You are invited"
        title="Your seat is ready."
      >
        <FormStatus>Account created for {email}.</FormStatus>
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
          aria-busy={acceptMutation.isPending}
          className="w-full justify-center text-sm transition-none"
          disabled={acceptMutation.isPending}
          type="submit"
          variant="primary"
        >
          {acceptMutation.isPending ? "Creating account..." : "Accept invitation"}
        </Button>
      </form>
    </M1Layout>
  );
}

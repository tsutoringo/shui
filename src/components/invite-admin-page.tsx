import { Button, Input, LinkButton } from "@cloudflare/kumo";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { formatApiError, type InvitationCreated } from "../lib/api-client";
import { createInvitationMutationOptions } from "../lib/api-query-options";
import { FormError, FormStatus, M1Layout } from "./m1-layout";

export function InviteAdminPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [created, setCreated] = useState<InvitationCreated>();
  const invitationMutation = useMutation(createInvitationMutationOptions());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    try {
      const invitation = await invitationMutation.mutateAsync({ email, name: name || undefined });
      setCreated(invitation);
    } catch (submitError) {
      setError(formatApiError(submitError));
    }
  }

  const invitationUrl =
    created && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${encodeURIComponent(created.token)}`
      : undefined;

  return (
    <M1Layout
      description="Invite people into Shui without opening public registration. Every invitation is single-use and expires automatically."
      eyebrow="Access management"
      title="Give someone a seat."
      footer={
        <p className="text-sm text-kumo-subtle">
          Need a different account?{" "}
          <LinkButton href="/sign-in" variant="ghost">
            Sign in
          </LinkButton>
        </p>
      }
    >
      {created ? (
        <div className="space-y-5">
          <div>
            <h2 className="text-xl font-semibold text-kumo-strong">Invitation created</h2>
            <p className="mt-2 text-sm leading-6 text-kumo-subtle">
              Send this link through your approved channel. It will not be shown again after you
              leave this page.
            </p>
            {created.deliveryPending ? (
              <p className="mt-3 text-sm text-kumo-subtle" role="status">
                Transactional email delivery is pending. Use this link or retry through your
                approved channel.
              </p>
            ) : null}
          </div>
          <div className="rounded-lg border border-kumo-line bg-kumo-recessed p-4">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-kumo-subtle">
              Single-use invitation link
            </p>
            <p className="mt-3 break-all font-mono text-sm leading-6 text-kumo-strong">
              {invitationUrl ?? "Preparing link..."}
            </p>
            <p className="mt-3 text-xs leading-5 text-kumo-subtle">
              Expires {new Date(created.expiresAt).toLocaleString()}.
            </p>
          </div>
          <Button
            className="w-full justify-center text-sm transition-none"
            onClick={() => {
              if (invitationUrl) void navigator.clipboard?.writeText(invitationUrl);
            }}
            type="button"
            variant="primary"
          >
            Copy invitation link
          </Button>
          <LinkButton className="w-full justify-center text-sm" href="/invite" variant="ghost">
            Create another invitation
          </LinkButton>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={submit}>
          <div>
            <h2 className="text-xl font-semibold text-kumo-strong">New invitation</h2>
            <p className="mt-2 text-sm leading-6 text-kumo-subtle">
              The recipient must use this exact email address.
            </p>
          </div>
          <Input
            autoComplete="email"
            className="text-sm transition-none"
            id="invite-email"
            label="Email address"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
          <Input
            autoComplete="name"
            className="text-sm transition-none"
            id="invite-name"
            label="Name (optional)"
            onChange={(event) => setName(event.target.value)}
            value={name}
          />
          {error ? <FormError>{error}</FormError> : null}
          <Button
            aria-busy={invitationMutation.isPending}
            className="w-full justify-center text-sm transition-none"
            disabled={invitationMutation.isPending}
            type="submit"
            variant="primary"
          >
            {invitationMutation.isPending ? "Creating invitation..." : "Create invitation"}
          </Button>
          <FormStatus>Invitations expire after seven days.</FormStatus>
        </form>
      )}
    </M1Layout>
  );
}

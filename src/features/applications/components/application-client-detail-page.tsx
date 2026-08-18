import { Badge, Button, Input, InputGroup, LayerCard, LinkButton } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import type { ApplicationClient } from "~/features/applications/api/client";
import {
  applicationClientsQueryOptions,
  applicationQueryKeys,
  deleteApplicationClientMutationOptions,
  setApplicationClientStatusMutationOptions,
  updateApplicationClientMutationOptions,
} from "~/features/applications/api/queries";
import { formatApiError } from "~/shared/api/errors";
import {
  AdminConfirmDialog,
  AdminError,
  AdminStatus,
  StatusPill,
} from "~/features/admin/components/admin-layout";
import { useApplicationDetail } from "./application-detail-page";

type OidcEndpoints = {
  authorization: string;
  discovery: string;
  endSession: string;
  introspection: string;
  issuer: string;
  jwks: string;
  oauthMetadata: string;
  revocation: string;
  token: string;
  userInfo: string;
};

export function ApplicationClientDetailPage({
  applicationId,
  clientId,
}: Readonly<{ applicationId: string; clientId: string }>) {
  const { application, onDeleted, onRefresh } = useApplicationDetail();
  const queryClient = useQueryClient();
  const clientsQuery = useQuery(applicationClientsQueryOptions(applicationId));
  const updateMutation = useMutation(updateApplicationClientMutationOptions());
  const statusMutation = useMutation(setApplicationClientStatusMutationOptions());
  const deleteMutation = useMutation(deleteApplicationClientMutationOptions());
  const [origin, setOrigin] = useState("");
  const [name, setName] = useState("");
  const [redirectUris, setRedirectUris] = useState("");
  const [scopes, setScopes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const client = clientsQuery.data?.clients.find((candidate) => candidate.clientId === clientId);
  const endpoints = createOidcEndpoints(origin);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!client) return;
    setName(client.name);
    setRedirectUris(client.redirectUris.join("\n"));
    setScopes(client.scopes.join(" "));
  }, [client?.clientId, client?.updatedAt]);

  async function run(action: () => Promise<unknown>, message: string, after?: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: applicationQueryKeys.detail(applicationId) }),
        queryClient.invalidateQueries({ queryKey: applicationQueryKeys.clients(applicationId) }),
      ]);
      await onRefresh(message);
      await after?.();
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusy(false);
    }
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;
    void run(
      () =>
        updateMutation.mutateAsync({
          body: {
            name: name.trim(),
            redirectUris: parseRedirectUris(redirectUris),
            scopes: parseScopes(scopes),
          },
          clientId: client.clientId,
          id: applicationId,
        }),
      "OIDC client updated.",
    );
  }

  return (
    <div className="space-y-6">
      {clientsQuery.isLoading ? <AdminStatus>Loading OIDC client...</AdminStatus> : null}
      {clientsQuery.isError ? <AdminError>{formatApiError(clientsQuery.error)}</AdminError> : null}
      {error ? <AdminError>{error}</AdminError> : null}
      {!clientsQuery.isLoading && !clientsQuery.isError && !client ? (
        <div className="space-y-4">
          <AdminError>The OIDC client is no longer available.</AdminError>
          <LinkButton href={`/admin/applications/${applicationId}/oidc`} variant="secondary">
            Back to OIDC clients
          </LinkButton>
        </div>
      ) : null}
      {client ? (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.16em] text-(--tangerine)">
                OIDC client detail
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-kumo-strong">
                {client.name}
              </h2>
              <p className="mt-2 break-all font-mono text-xs text-kumo-subtle">{client.clientId}</p>
            </div>
            <div className="flex items-center gap-3">
              <StatusPill status={client.disabled ? "disabled" : "active"} />
              <Badge appearance="filled" variant="neutral">
                {client.clientType} · PKCE S256
              </Badge>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.75fr)]">
            <div className="space-y-6">
              <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
                <h3 className="text-xl font-semibold text-kumo-strong">Client settings</h3>
                <p className="mt-2 text-sm leading-6 text-kumo-subtle">
                  These are the values stored for this client. Update the callback URLs and scopes
                  here when the client application changes.
                </p>
                <dl className="mt-6 grid gap-x-5 gap-y-4 border-t border-kumo-hairline pt-5 sm:grid-cols-2">
                  <RegistrationField
                    copyValue={client.clientId}
                    label="Client ID"
                    value={client.clientId}
                  />
                  <RegistrationField label="Client type" value={client.clientType} />
                  <RegistrationField
                    label="Token endpoint authentication"
                    value={tokenEndpointAuthMethod(client)}
                  />
                  <RegistrationField label="PKCE" value="Required · S256" />
                  <RegistrationField label="Created" value={formatDateTime(client.createdAt)} />
                  <RegistrationField label="Updated" value={formatDateTime(client.updatedAt)} />
                </dl>
                <form
                  className="mt-6 grid gap-4 border-t border-kumo-hairline pt-5"
                  onSubmit={save}
                >
                  <Input
                    id={`client-detail-name-${client.clientId}`}
                    label="Name"
                    onChange={(event) => setName(event.target.value)}
                    required
                    value={name}
                  />
                  <label
                    className="grid gap-1 text-sm font-medium text-kumo-strong"
                    htmlFor={`client-detail-redirects-${client.clientId}`}
                  >
                    Redirect URIs
                    <textarea
                      aria-describedby={`client-detail-redirects-help-${client.clientId}`}
                      className="min-h-28 rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 font-mono text-xs text-kumo-strong outline-none focus-visible:ring-2 focus-visible:ring-(--tangerine)"
                      id={`client-detail-redirects-${client.clientId}`}
                      onChange={(event) => setRedirectUris(event.target.value)}
                      required
                      value={redirectUris}
                    />
                    <span
                      className="font-normal text-kumo-subtle"
                      id={`client-detail-redirects-help-${client.clientId}`}
                    >
                      One HTTPS URI per line. Local HTTP is accepted for development.
                    </span>
                  </label>
                  <Input
                    id={`client-detail-scopes-${client.clientId}`}
                    label="Scopes"
                    onChange={(event) => setScopes(event.target.value)}
                    value={scopes}
                  />
                  <div className="flex flex-wrap gap-3">
                    <Button aria-busy={busy} disabled={busy} type="submit" variant="primary">
                      Save changes
                    </Button>
                    <Button
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () =>
                            statusMutation.mutateAsync({
                              clientId: client.clientId,
                              id: applicationId,
                              status: client.disabled ? "active" : "disabled",
                            }),
                          client.disabled ? "OIDC client enabled." : "OIDC client disabled.",
                        )
                      }
                      type="button"
                      variant="ghost"
                    >
                      {client.disabled ? "Enable client" : "Disable client"}
                    </Button>
                    <AdminConfirmDialog
                      confirmLabel="Delete client"
                      description="Existing tokens and consents for this Client will no longer be usable."
                      onConfirm={() =>
                        void run(
                          () =>
                            deleteMutation.mutateAsync({
                              clientId: client.clientId,
                              id: applicationId,
                            }),
                          "OIDC client deleted.",
                          onDeleted,
                        )
                      }
                      title={`Delete ${client.name}?`}
                      trigger={
                        <Button disabled={busy} type="button" variant="secondary-destructive">
                          Delete client
                        </Button>
                      }
                    />
                  </div>
                </form>
              </LayerCard>

              <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
                <h3 className="text-xl font-semibold text-kumo-strong">OIDC provider endpoints</h3>
                <p className="mt-2 text-sm leading-6 text-kumo-subtle">
                  Use these URLs when configuring the OIDC client application. The values are
                  derived from the current Shui issuer.
                </p>
                <dl className="mt-6 grid gap-4 border-t border-kumo-hairline pt-5">
                  <RegistrationField
                    copyValue={endpoints.issuer}
                    label="Issuer"
                    value={endpoints.issuer || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.discovery}
                    label="OpenID Connect discovery"
                    value={endpoints.discovery || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.oauthMetadata}
                    label="OAuth authorization server metadata"
                    value={endpoints.oauthMetadata || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.authorization}
                    label="Authorization endpoint"
                    value={endpoints.authorization || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.token}
                    label="Token endpoint"
                    value={endpoints.token || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.userInfo}
                    label="UserInfo endpoint"
                    value={endpoints.userInfo || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.jwks}
                    label="JWKS URI"
                    value={endpoints.jwks || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.endSession}
                    label="End-session endpoint"
                    value={endpoints.endSession || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.introspection}
                    label="Introspection endpoint"
                    value={endpoints.introspection || "Loading endpoint configuration..."}
                  />
                  <RegistrationField
                    copyValue={endpoints.revocation}
                    label="Revocation endpoint"
                    value={endpoints.revocation || "Loading endpoint configuration..."}
                  />
                </dl>
              </LayerCard>
            </div>

            <div className="space-y-6">
              <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
                <h3 className="text-xl font-semibold text-kumo-strong">Registration values</h3>
                <p className="mt-2 text-sm leading-6 text-kumo-subtle">
                  Copy these values into the client application's OIDC registration form.
                </p>
                <dl className="mt-6 grid gap-4 border-t border-kumo-hairline pt-5">
                  <RegistrationField
                    copyValue={client.clientId}
                    label="client_id"
                    value={client.clientId}
                  />
                  <RegistrationField
                    description={
                      client.clientType === "confidential"
                        ? "The secret was shown once after creation and cannot be retrieved."
                        : "Public clients do not use a client secret."
                    }
                    label="client_secret"
                    value={
                      client.clientType === "confidential"
                        ? "Not retrievable after creation"
                        : "Not used"
                    }
                  />
                  <RegistrationField
                    label="redirect_uris"
                    value={
                      client.redirectUris.length > 0 ? (
                        <ul className="space-y-1">
                          {client.redirectUris.map((redirectUri) => (
                            <li className="break-all" key={redirectUri}>
                              {redirectUri}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "No redirect URI configured"
                      )
                    }
                  />
                  <RegistrationField label="response_type" value="code" />
                  <RegistrationField label="grant_type" value="authorization_code" />
                  <RegistrationField
                    label="scope"
                    value={client.scopes.join(" ")}
                    copyValue={client.scopes.join(" ")}
                  />
                  <RegistrationField
                    copyValue={application.resourceIdentifier}
                    description="Pass this value as the OAuth resource parameter when requesting API access."
                    label="resource / audience"
                    value={application.resourceIdentifier}
                  />
                  <RegistrationField
                    label="token_endpoint_auth_method"
                    value={tokenEndpointAuthMethod(client)}
                  />
                  <RegistrationField label="code_challenge_method" value="S256" />
                  <RegistrationField label="application_type" value="web" />
                </dl>
              </LayerCard>

              <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
                <h3 className="text-xl font-semibold text-kumo-strong">
                  Client registration notes
                </h3>
                <ul className="mt-4 space-y-3 text-sm leading-6 text-kumo-subtle">
                  <li>
                    Dynamic client registration is disabled. Create and manage clients from this
                    Administration screen.
                  </li>
                  <li>
                    Authorization code flow with PKCE S256 is required for human OIDC clients.
                  </li>
                  <li>
                    Keep the client secret private. If a confidential client's secret is lost,
                    create a new client instead of trying to recover it.
                  </li>
                </ul>
              </LayerCard>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function RegistrationField({
  copyValue,
  description,
  label,
  value,
}: Readonly<{
  copyValue?: string;
  description?: string;
  label: string;
  value: ReactNode;
}>) {
  return (
    <div>
      <dt className="text-sm text-kumo-subtle">{label}</dt>
      <dd className="mt-1">
        {copyValue ? (
          <CopyableValue label={label} value={copyValue} />
        ) : (
          <div className="min-w-0 break-all font-mono text-xs leading-5 text-kumo-strong">
            {value}
          </div>
        )}
        {description ? (
          <p className="mt-1 text-xs leading-5 text-kumo-subtle">{description}</p>
        ) : null}
      </dd>
    </div>
  );
}

function CopyableValue({ label, value }: Readonly<{ label: string; value: string }>) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <InputGroup className="w-full">
      <InputGroup.Input
        aria-label={label}
        className="cursor-not-allowed bg-kumo-overlay! font-mono text-xs text-kumo-inactive!"
        readOnly
        value={value}
      />
      <InputGroup.Addon align="end" className="pr-1">
        <InputGroup.Button
          aria-label={`Copy ${label}`}
          onClick={() => void copy()}
          tooltip={`Copy ${label}`}
          variant="secondary"
        >
          {copied ? "Copied" : "Copy"}
        </InputGroup.Button>
      </InputGroup.Addon>
    </InputGroup>
  );
}

function createOidcEndpoints(origin: string): OidcEndpoints {
  const issuer = origin ? `${origin}/api/auth` : "";
  return {
    authorization: issuer ? `${issuer}/oauth2/authorize` : "",
    discovery: issuer ? `${issuer}/.well-known/openid-configuration` : "",
    endSession: issuer ? `${issuer}/oauth2/end-session` : "",
    introspection: issuer ? `${issuer}/oauth2/introspect` : "",
    issuer,
    jwks: issuer ? `${issuer}/jwks` : "",
    oauthMetadata: origin ? `${origin}/.well-known/oauth-authorization-server/api/auth` : "",
    revocation: issuer ? `${issuer}/oauth2/revoke` : "",
    token: issuer ? `${issuer}/oauth2/token` : "",
    userInfo: issuer ? `${issuer}/oauth2/userinfo` : "",
  };
}

function tokenEndpointAuthMethod(client: ApplicationClient) {
  return client.clientType === "confidential" ? "client_secret_basic" : "none";
}

function parseRedirectUris(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseScopes(value: string) {
  return value
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString();
}

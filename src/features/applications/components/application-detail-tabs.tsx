import { Badge, Button, Dialog, Input, LayerCard, Select } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { Application, ApplicationClientCreated } from "~/features/applications/api/client";
import {
  applicationAccessQueryOptions,
  applicationClientsQueryOptions,
  applicationQueryKeys,
  applicationOwnersQueryOptions,
  applicationRolesQueryOptions,
  createApplicationClientMutationOptions,
  createApplicationRoleMutationOptions,
  deleteApplicationClientMutationOptions,
  deleteApplicationMutationOptions,
  deleteApplicationRoleMutationOptions,
  grantApplicationRoleMutationOptions,
  removeApplicationAssignmentMutationOptions,
  revokeApplicationRoleMutationOptions,
  setApplicationAssignmentMutationOptions,
  setApplicationClientStatusMutationOptions,
  setApplicationStatusMutationOptions,
  transferApplicationOwnershipMutationOptions,
  updateApplicationClientMutationOptions,
  updateApplicationMutationOptions,
  updateApplicationRoleMutationOptions,
} from "~/features/applications/api/queries";
import { formatApiError } from "~/shared/api/errors";
import {
  AdminConfirmDialog,
  AdminError,
  AdminStatus,
  StatusPill,
} from "~/features/admin/components/admin-layout";
import { useApplicationDetail } from "./application-detail-page";

export function ApplicationOverviewTab() {
  const { application } = useApplicationDetail();
  return (
    <div className="space-y-6">
      <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
        <h3 className="text-xl font-semibold text-kumo-strong">Application overview</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-kumo-subtle">
          {application.description || "No description provided."}
        </p>
        <dl className="mt-6 grid gap-5 border-t border-kumo-hairline pt-5 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-sm text-kumo-subtle">Resource identifier</dt>
            <dd className="mt-1 break-all font-mono text-xs text-kumo-strong">
              {application.resourceIdentifier}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">Owner</dt>
            <dd className="mt-1 font-medium text-kumo-strong">{application.owner.label}</dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">Authorization version</dt>
            <dd className="mt-1 font-medium text-kumo-strong">{application.authzVersion}</dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">Roles</dt>
            <dd className="mt-1 font-medium text-kumo-strong">{application.roleCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">Assignments</dt>
            <dd className="mt-1 font-medium text-kumo-strong">{application.assignmentCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">OIDC clients</dt>
            <dd className="mt-1 font-medium text-kumo-strong">{application.clientCount}</dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">Created</dt>
            <dd className="mt-1 font-medium text-kumo-strong">
              {new Date(application.createdAt).toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-kumo-subtle">Updated</dt>
            <dd className="mt-1 font-medium text-kumo-strong">
              {new Date(application.updatedAt).toLocaleString()}
            </dd>
          </div>
        </dl>
      </LayerCard>
    </div>
  );
}

export function ApplicationSettingsTab() {
  const { application, onDeleted, onRefresh } = useApplicationDetail();
  const ownersQuery = useQuery(applicationOwnersQueryOptions);
  return (
    <>
      {ownersQuery.isLoading ? <AdminStatus>Loading owners...</AdminStatus> : null}
      {ownersQuery.isError ? <AdminError>{formatApiError(ownersQuery.error)}</AdminError> : null}
      <ApplicationSettings
        application={application}
        onDeleted={onDeleted}
        onRefresh={onRefresh}
        owners={ownersQuery.data}
      />
    </>
  );
}

export function ApplicationRolesTab() {
  const { application, onRefresh } = useApplicationDetail();
  return <ApplicationRoles applicationId={application.id} onRefresh={onRefresh} />;
}

export function ApplicationClientsTab() {
  const { application, onRefresh } = useApplicationDetail();
  return <ApplicationClients applicationId={application.id} onRefresh={onRefresh} />;
}

export function ApplicationAccessTab() {
  const { application, onRefresh } = useApplicationDetail();
  return <ApplicationAccess applicationId={application.id} onRefresh={onRefresh} />;
}

function ApplicationSettings({
  application,
  onDeleted,
  onRefresh,
  owners,
}: Readonly<{
  application: Application;
  onDeleted: () => Promise<void>;
  onRefresh: (message?: string) => Promise<void>;
  owners:
    | {
        teams: Array<{ id: string; name: string }>;
        users: Array<{ id: string; name: string }>;
      }
    | undefined;
}>) {
  const queryClient = useQueryClient();
  const updateMutation = useMutation(updateApplicationMutationOptions());
  const transferMutation = useMutation(transferApplicationOwnershipMutationOptions());
  const statusMutation = useMutation(setApplicationStatusMutationOptions());
  const deleteMutation = useMutation(deleteApplicationMutationOptions());
  const [name, setName] = useState(application.name);
  const [description, setDescription] = useState(application.description ?? "");
  const [ownerType, setOwnerType] = useState<"user" | "team">(application.owner.type);
  const [ownerId, setOwnerId] = useState(application.owner.id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const ownerItems =
    ownerType === "user"
      ? (owners?.users ?? []).map((owner) => ({ label: owner.name, value: owner.id }))
      : (owners?.teams ?? []).map((owner) => ({ label: owner.name, value: owner.id }));

  async function run(action: () => Promise<unknown>, message: string, after?: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all });
      await onRefresh(message);
      await after?.();
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-kumo-strong">Application settings</h3>
          <p className="mt-2 max-w-3xl break-all font-mono text-xs leading-5 text-kumo-subtle">
            Resource: {application.resourceIdentifier}
          </p>
        </div>
        <StatusPill status={application.status} />
      </div>
      <form
        className="mt-5 grid gap-4 border-t border-kumo-hairline pt-5 md:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              updateMutation.mutateAsync({
                body: { description: description || null, name },
                id: application.id,
              }),
            "Application updated.",
          );
        }}
      >
        <Input
          id={`application-name-${application.id}`}
          label="Name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <Input
          id={`application-description-${application.id}`}
          label="Description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <div className="flex flex-wrap gap-3 md:col-span-2">
          <Button disabled={busy} type="submit" variant="primary">
            Save details
          </Button>
          <Button
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  statusMutation.mutateAsync({
                    id: application.id,
                    status: application.status === "active" ? "disabled" : "active",
                  }),
                application.status === "active" ? "Application disabled." : "Application enabled.",
              )
            }
            type="button"
            variant="ghost"
          >
            {application.status === "active" ? "Disable" : "Enable"}
          </Button>
          <AdminConfirmDialog
            confirmLabel="Delete application"
            description="The application can only be deleted when it has no Clients, Roles, Grants, or Assignments. This action cannot be undone."
            onConfirm={() =>
              void run(
                () => deleteMutation.mutateAsync(application.id),
                "Application deleted.",
                onDeleted,
              )
            }
            title={`Delete ${application.name}?`}
            trigger={
              <Button disabled={busy} type="button" variant="secondary-destructive">
                Delete
              </Button>
            }
          />
        </div>
      </form>
      <div className="mt-5 border-t border-kumo-hairline pt-5">
        <p className="text-sm text-kumo-subtle">
          Current owner:{" "}
          <span className="font-medium text-kumo-strong">{application.owner.label}</span> (
          {application.owner.type})
        </p>
        <form
          className="mt-4 grid gap-3 md:grid-cols-[12rem_minmax(0,1fr)_auto] md:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (!ownerId) return;
            void run(
              () =>
                transferMutation.mutateAsync({ body: { ownerId, ownerType }, id: application.id }),
              "Application ownership transferred.",
            );
          }}
        >
          <Select
            items={[
              { label: "User", value: "user" },
              { label: "Team", value: "team" },
            ]}
            label="Transfer type"
            onValueChange={(value) => {
              const nextType = value === "team" ? "team" : "user";
              setOwnerType(nextType);
              setOwnerId("");
            }}
            value={ownerType}
          />
          <Select
            items={ownerItems}
            label="New owner"
            onValueChange={(value) => setOwnerId(value ?? "")}
            placeholder="Choose an owner"
            required
            value={ownerId || null}
          />
          <Button disabled={busy || !ownerId} type="submit" variant="secondary">
            Transfer ownership
          </Button>
        </form>
      </div>
      {error ? <AdminError>{error}</AdminError> : null}
    </LayerCard>
  );
}

function ApplicationRoles({
  applicationId,
  onRefresh,
}: Readonly<{ applicationId: string; onRefresh: (message?: string) => Promise<void> }>) {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery(applicationRolesQueryOptions(applicationId));
  const createMutation = useMutation(createApplicationRoleMutationOptions());
  const updateMutation = useMutation(updateApplicationRoleMutationOptions());
  const deleteMutation = useMutation(deleteApplicationRoleMutationOptions());
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.detail(applicationId),
      });
      await onRefresh(message);
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusy(false);
    }
  }

  const roles = rolesQuery.data?.roles ?? [];
  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <h3 className="text-xl font-semibold text-kumo-strong">Application roles</h3>
      <form
        className="mt-5 grid gap-3 border-b border-kumo-hairline pb-5"
        onSubmit={(event) => {
          event.preventDefault();
          void run(
            () =>
              createMutation.mutateAsync({
                body: { description: description || undefined, key, name },
                id: applicationId,
              }),
            "Application role created.",
          ).then(() => {
            setKey("");
            setName("");
            setDescription("");
          });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            id={`role-key-${applicationId}`}
            label="Key"
            onChange={(event) => setKey(event.target.value)}
            pattern="[a-z0-9][a-z0-9._:-]*"
            required
            value={key}
          />
          <Input
            id={`role-name-${applicationId}`}
            label="Display name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
        </div>
        <Input
          id={`role-description-${applicationId}`}
          label="Description (optional)"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <Button disabled={busy} type="submit" variant="primary">
          Create role
        </Button>
      </form>
      {rolesQuery.isLoading ? <AdminStatus>Loading roles...</AdminStatus> : null}
      {rolesQuery.isError ? <AdminError>{formatApiError(rolesQuery.error)}</AdminError> : null}
      {error ? <AdminError>{error}</AdminError> : null}
      <ul className="mt-5 space-y-3">
        {roles.map((role) => (
          <li className="rounded-md bg-kumo-canvas p-3" key={role.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-kumo-strong">{role.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-(--tangerine)">{role.key}</p>
                <p className="mt-1 text-xs text-kumo-subtle">
                  {role.grantCount} grants · {role.status}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        updateMutation.mutateAsync({
                          body: { status: role.status === "active" ? "disabled" : "active" },
                          id: applicationId,
                          roleKey: role.key,
                        }),
                      role.status === "active" ? "Role disabled." : "Role enabled.",
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  {role.status === "active" ? "Disable" : "Enable"}
                </Button>
                <AdminConfirmDialog
                  confirmLabel="Delete role"
                  description="A role with grants cannot be deleted. Remove its grants first."
                  onConfirm={() =>
                    void run(
                      () => deleteMutation.mutateAsync({ id: applicationId, roleKey: role.key }),
                      "Role deleted.",
                    )
                  }
                  title={`Delete ${role.name}?`}
                  trigger={
                    <Button disabled={busy} type="button" variant="secondary-destructive">
                      Delete
                    </Button>
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!rolesQuery.isLoading && roles.length === 0 ? (
        <p className="mt-5 text-sm text-kumo-subtle">No roles defined.</p>
      ) : null}
    </LayerCard>
  );
}

function ApplicationClients({
  applicationId,
  onRefresh,
}: Readonly<{ applicationId: string; onRefresh: (message?: string) => Promise<void> }>) {
  const queryClient = useQueryClient();
  const clientsQuery = useQuery(applicationClientsQueryOptions(applicationId));
  const createMutation = useMutation(createApplicationClientMutationOptions());
  const updateMutation = useMutation(updateApplicationClientMutationOptions());
  const statusMutation = useMutation(setApplicationClientStatusMutationOptions());
  const deleteMutation = useMutation(deleteApplicationClientMutationOptions());
  const [name, setName] = useState("");
  const [clientType, setClientType] = useState<"public" | "confidential">("public");
  const [redirectUris, setRedirectUris] = useState("");
  const [scopes, setScopes] = useState("openid profile email");
  const [secret, setSecret] = useState<ApplicationClientCreated | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(undefined);
    try {
      const result = await action();
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.detail(applicationId),
      });
      await onRefresh(message);
      return result;
    } catch (actionError) {
      setError(formatApiError(actionError));
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  const clients = clientsQuery.data?.clients ?? [];
  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <h3 className="text-xl font-semibold text-kumo-strong">Human OIDC clients</h3>
      <form
        className="mt-5 grid gap-3 border-b border-kumo-hairline pb-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const result = await run(
            () =>
              createMutation.mutateAsync({
                body: {
                  clientType,
                  name,
                  redirectUris: redirectUris
                    .split(/\n|,/)
                    .map((value) => value.trim())
                    .filter(Boolean),
                  scopes: scopes.split(/\s+/).filter(Boolean),
                },
                id: applicationId,
              }),
            "OIDC client created.",
          );
          if (result) {
            setSecret(result as ApplicationClientCreated);
            setAcknowledged(false);
            setName("");
            setRedirectUris("");
          }
        }}
      >
        <Input
          id={`client-name-${applicationId}`}
          label="Name"
          onChange={(event) => setName(event.target.value)}
          required
          value={name}
        />
        <Select
          items={[
            { label: "Public · PKCE", value: "public" },
            { label: "Confidential · PKCE", value: "confidential" },
          ]}
          label="Client type"
          onValueChange={(value) =>
            setClientType(value === "confidential" ? "confidential" : "public")
          }
          value={clientType}
        />
        <label
          className="grid gap-1 text-sm font-medium text-kumo-strong"
          htmlFor={`client-redirects-${applicationId}`}
        >
          Redirect URIs
          <textarea
            aria-describedby={`client-redirects-help-${applicationId}`}
            className="min-h-20 rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 font-mono text-xs text-kumo-strong outline-none focus-visible:ring-2 focus-visible:ring-(--tangerine)"
            id={`client-redirects-${applicationId}`}
            onChange={(event) => setRedirectUris(event.target.value)}
            required
            value={redirectUris}
          />
          <span
            className="font-normal text-kumo-subtle"
            id={`client-redirects-help-${applicationId}`}
          >
            One HTTPS URI per line. Local HTTP is accepted for development.
          </span>
        </label>
        <Input
          id={`client-scopes-${applicationId}`}
          label="Scopes"
          onChange={(event) => setScopes(event.target.value)}
          value={scopes}
        />
        <Button disabled={busy} type="submit" variant="primary">
          Create OIDC client
        </Button>
      </form>
      {clientsQuery.isLoading ? <AdminStatus>Loading OIDC clients...</AdminStatus> : null}
      {clientsQuery.isError ? <AdminError>{formatApiError(clientsQuery.error)}</AdminError> : null}
      {error ? <AdminError>{error}</AdminError> : null}
      <ul className="mt-5 space-y-3">
        {clients.map((client) => (
          <li className="rounded-md bg-kumo-canvas p-3" key={client.clientId}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-kumo-strong">{client.name}</p>
                <p className="mt-1 break-all font-mono text-xs text-kumo-subtle">
                  {client.clientId}
                </p>
                <p className="mt-1 text-xs text-kumo-subtle">
                  {client.clientType} · {client.disabled ? "disabled" : "active"} · PKCE S256
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  disabled={busy}
                  onClick={() =>
                    void run(
                      () =>
                        updateMutation.mutateAsync({
                          body: { scopes: client.scopes },
                          clientId: client.clientId,
                          id: applicationId,
                        }),
                      "OIDC client refreshed.",
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  Save scopes
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
                  {client.disabled ? "Enable" : "Disable"}
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
                    )
                  }
                  title={`Delete ${client.name}?`}
                  trigger={
                    <Button disabled={busy} type="button" variant="secondary-destructive">
                      Delete
                    </Button>
                  }
                />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {!clientsQuery.isLoading && clients.length === 0 ? (
        <p className="mt-5 text-sm text-kumo-subtle">No human OIDC clients defined.</p>
      ) : null}
      {secret ? (
        <Dialog.Root
          onOpenChange={(open) => {
            if (!open) setSecret(null);
          }}
          open
        >
          <Dialog className="p-6" size="lg">
            <Dialog.Title className="text-lg font-semibold text-kumo-strong">
              Save this Client secret now
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-kumo-subtle">
              Shui stores only a hash. This value will not be shown again.
            </Dialog.Description>
            <label
              className="mt-5 grid gap-2 text-sm font-medium text-kumo-strong"
              htmlFor="new-client-secret"
            >
              Client secret
              <input
                className="rounded-md border border-kumo-line bg-kumo-canvas px-3 py-2 font-mono text-xs text-kumo-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tangerine)"
                id="new-client-secret"
                readOnly
                value={secret.clientSecret ?? ""}
              />
            </label>
            <label className="mt-5 flex items-start gap-3 text-sm text-kumo-subtle">
              <input
                checked={acknowledged}
                className="mt-1 size-4 accent-(--tangerine)"
                onChange={(event) => setAcknowledged(event.target.checked)}
                type="checkbox"
              />
              I have stored this secret securely.
            </label>
            <div className="mt-6 flex justify-end">
              <Dialog.Close
                disabled={!acknowledged}
                render={(props) => (
                  <Button {...props} disabled={!acknowledged} type="button" variant="primary">
                    Done
                  </Button>
                )}
              />
            </div>
          </Dialog>
        </Dialog.Root>
      ) : null}
    </LayerCard>
  );
}

function ApplicationAccess({
  applicationId,
  onRefresh,
}: Readonly<{ applicationId: string; onRefresh: (message?: string) => Promise<void> }>) {
  const queryClient = useQueryClient();
  const accessQuery = useQuery(applicationAccessQueryOptions(applicationId));
  const rolesQuery = useQuery(applicationRolesQueryOptions(applicationId));
  const setAssignmentMutation = useMutation(setApplicationAssignmentMutationOptions());
  const removeAssignmentMutation = useMutation(removeApplicationAssignmentMutationOptions());
  const grantMutation = useMutation(grantApplicationRoleMutationOptions());
  const revokeMutation = useMutation(revokeApplicationRoleMutationOptions());
  const [subjectType, setSubjectType] = useState<"user" | "service-account" | "team">("user");
  const [subjectId, setSubjectId] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const access = accessQuery.data;

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      await queryClient.invalidateQueries({
        queryKey: applicationQueryKeys.detail(applicationId),
      });
      await onRefresh(message);
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusy(false);
    }
  }

  const subjects =
    subjectType === "user"
      ? (access?.users ?? []).map((subject) => ({
          label: `${subject.name} · ${subject.email}`,
          value: subject.principalId,
        }))
      : subjectType === "service-account"
        ? (access?.serviceAccounts ?? []).map((subject) => ({
            label: subject.name,
            value: subject.principalId,
          }))
        : (access?.teams ?? []).map((subject) => ({ label: subject.name, value: subject.id }));
  const roles = (rolesQuery.data?.roles ?? []).filter((role) => role.status === "active");

  function revokeRole(role: AccessRoleItem) {
    void run(
      () =>
        revokeMutation.mutateAsync({
          id: applicationId,
          roleKey: role.key,
          subjectId: role.subjectId,
          subjectType: role.subjectType,
        }),
      "Role revoked.",
    );
  }

  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-xl font-semibold text-kumo-strong">Assignments and role origins</h3>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-kumo-subtle">
            Assignments control access. Role origins show whether a role is direct or inherited from
            a Team.
          </p>
        </div>
        <Badge appearance="filled" variant="neutral">
          {access?.users.length ?? 0} users
        </Badge>
      </div>
      <div className="mt-5 grid gap-3 border-b border-kumo-hairline pb-5 md:grid-cols-[12rem_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <Select
          items={[
            { label: "User", value: "user" },
            { label: "Service account", value: "service-account" },
            { label: "Team", value: "team" },
          ]}
          label="Subject type"
          onValueChange={(value) => {
            const nextType = value === "service-account" || value === "team" ? value : "user";
            setSubjectType(nextType);
            setSubjectId("");
          }}
          value={subjectType}
        />
        <Select
          items={subjects}
          label="Subject"
          onValueChange={(value) => setSubjectId(value ?? "")}
          placeholder="Choose a subject"
          required
          value={subjectId || null}
        />
        <Select
          items={roles.map((role) => ({ label: `${role.name} · ${role.key}`, value: role.key }))}
          label="Role"
          onValueChange={(value) => setRoleKey(value ?? "")}
          placeholder="Choose a role"
          value={roleKey || null}
        />
        <div className="flex gap-2">
          <Button
            disabled={busy || !subjectId}
            onClick={() =>
              void run(
                () =>
                  setAssignmentMutation.mutateAsync({
                    body: { status: "active", subjectId, subjectType },
                    id: applicationId,
                  }),
                "Assignment saved.",
              )
            }
            type="button"
            variant="primary"
          >
            Assign
          </Button>
          <Button
            disabled={busy || !subjectId || !roleKey}
            onClick={() =>
              void run(
                () =>
                  grantMutation.mutateAsync({
                    body: { roleKey, subjectId, subjectType },
                    id: applicationId,
                  }),
                "Role granted.",
              )
            }
            type="button"
            variant="secondary"
          >
            Grant role
          </Button>
        </div>
      </div>
      {accessQuery.isLoading ? <AdminStatus>Loading effective access...</AdminStatus> : null}
      {accessQuery.isError ? <AdminError>{formatApiError(accessQuery.error)}</AdminError> : null}
      {error ? <AdminError>{error}</AdminError> : null}
      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <caption className="sr-only">Application access subjects</caption>
          <thead className="border-b border-kumo-line text-xs uppercase tracking-wide text-kumo-subtle">
            <tr>
              <th className="px-3 py-3 font-medium" scope="col">
                Subject
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Assignment
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Roles and origins
              </th>
              <th className="px-3 py-3 font-medium" scope="col">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {(access?.users ?? []).map((subject) => (
              <AccessRow
                key={subject.principalId}
                id={subject.principalId}
                label={`${subject.name} · ${subject.email}`}
                assignmentStatus={subject.assignmentStatus}
                roles={[
                  ...subject.directRoles.map((key) => ({
                    effective: subject.effectiveRoles.includes(key),
                    key,
                    label: `${key} · direct${subject.effectiveRoles.includes(key) ? "" : " · not effective"}`,
                    subjectId: subject.principalId,
                    subjectType: "user" as const,
                  })),
                  ...subject.teamRoles.map((origin) => ({
                    effective: subject.effectiveRoles.includes(origin.roleKey),
                    key: origin.roleKey,
                    label: `${origin.roleKey} · ${origin.teamName ?? "team"}${subject.effectiveRoles.includes(origin.roleKey) ? "" : " · not effective"}`,
                    subjectId: origin.teamId ?? "",
                    subjectType: "team" as const,
                  })),
                ]}
                onRemove={() =>
                  void run(
                    () =>
                      removeAssignmentMutation.mutateAsync({
                        id: applicationId,
                        subjectId: subject.principalId,
                        subjectType: "user",
                      }),
                    "Assignment removed.",
                  )
                }
                onRevoke={revokeRole}
              />
            ))}
            {(access?.serviceAccounts ?? []).map((subject) => (
              <AccessRow
                key={subject.principalId}
                id={subject.principalId}
                label={subject.name}
                assignmentStatus={subject.assignmentStatus}
                roles={subject.directRoles.map((key) => ({
                  effective: subject.effectiveRoles.includes(key),
                  key,
                  label: `${key} · direct${subject.effectiveRoles.includes(key) ? "" : " · not effective"}`,
                  subjectId: subject.principalId,
                  subjectType: "service-account" as const,
                }))}
                onRemove={() =>
                  void run(
                    () =>
                      removeAssignmentMutation.mutateAsync({
                        id: applicationId,
                        subjectId: subject.principalId,
                        subjectType: "service-account",
                      }),
                    "Assignment removed.",
                  )
                }
                onRevoke={revokeRole}
              />
            ))}
            {(access?.teams ?? []).map((subject) => (
              <AccessRow
                key={subject.id}
                id={subject.id}
                label={subject.name}
                assignmentStatus={subject.assignmentStatus}
                roles={subject.directRoles.map((key) => ({
                  effective: subject.assignmentStatus === "active",
                  key,
                  label: `${key} · direct${subject.assignmentStatus === "active" ? "" : " · not effective"}`,
                  subjectId: subject.id,
                  subjectType: "team" as const,
                }))}
                onRemove={() =>
                  void run(
                    () =>
                      removeAssignmentMutation.mutateAsync({
                        id: applicationId,
                        subjectId: subject.id,
                        subjectType: "team",
                      }),
                    "Assignment removed.",
                  )
                }
                onRevoke={revokeRole}
              />
            ))}
          </tbody>
        </table>
      </div>
    </LayerCard>
  );
}

type AccessRoleItem = {
  effective: boolean;
  key: string;
  label: string;
  subjectId: string;
  subjectType: "user" | "service-account" | "team";
};

function AccessRow({
  assignmentStatus,
  id,
  label,
  onRemove,
  onRevoke,
  roles,
}: Readonly<{
  assignmentStatus: "active" | "suspended" | null;
  id: string;
  label: string;
  onRemove: () => void;
  onRevoke: (role: AccessRoleItem) => void;
  roles: AccessRoleItem[];
}>) {
  return (
    <tr className="border-b border-kumo-hairline align-top last:border-0">
      <th className="max-w-[18rem] break-words px-3 py-4 font-medium text-kumo-strong" scope="row">
        {label}
        <span className="mt-1 block break-all font-mono text-[11px] font-normal text-kumo-subtle">
          {id}
        </span>
      </th>
      <td className="px-3 py-4">
        <Badge
          appearance="dot"
          variant={
            assignmentStatus === "active"
              ? "success"
              : assignmentStatus === "suspended"
                ? "warning"
                : "neutral"
          }
        >
          {assignmentStatus ?? "not assigned"}
        </Badge>
      </td>
      <td className="px-3 py-4">
        <div className="flex flex-wrap gap-2">
          {roles.length ? (
            roles.map((role) => (
              <button
                className="rounded-full bg-kumo-canvas px-2.5 py-1 font-mono text-xs text-kumo-strong underline decoration-transparent underline-offset-2 transition-colors hover:decoration-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--tangerine)"
                aria-label={`Revoke ${role.label} from ${label}`}
                key={`${role.subjectType}:${role.subjectId}:${role.key}`}
                onClick={() => onRevoke(role)}
                type="button"
              >
                {role.label}
              </button>
            ))
          ) : (
            <span className="text-kumo-subtle">No effective roles</span>
          )}
        </div>
      </td>
      <td className="px-3 py-4">
        <Button disabled={!assignmentStatus} onClick={onRemove} type="button" variant="ghost">
          Remove
        </Button>
      </td>
    </tr>
  );
}

import { Button, Grid, Input, LayerCard, Select } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatApiError, type Application, type ServiceAccount } from "../../lib/api-client";
import {
  apiQueryKeys,
  applicationsQueryOptions,
  createServiceAccountCredentialMutationOptions,
  createServiceAccountMutationOptions,
  deleteServiceAccountCredentialMutationOptions,
  rotateServiceAccountCredentialMutationOptions,
  serviceAccountsQueryOptions,
  serviceAccountCredentialsQueryOptions,
  serviceAccountOwnersQueryOptions,
  setServiceAccountCredentialStatusMutationOptions,
  setServiceAccountStatusMutationOptions,
  transferServiceAccountMutationOptions,
  updateServiceAccountMutationOptions,
} from "../../lib/api-query-options";
import { AdminError, AdminLayout, AdminStatus, StatusPill } from "./admin-layout";

type CreatedCredentialSecret = { clientId: string; clientSecret: string };

function isCreatedCredential(value: unknown): value is CreatedCredentialSecret {
  return (
    typeof value === "object" &&
    value !== null &&
    "clientId" in value &&
    typeof value.clientId === "string" &&
    "clientSecret" in value &&
    typeof value.clientSecret === "string"
  );
}

export function ServiceAccountsAdminPage() {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery(serviceAccountsQueryOptions);
  const applicationsQuery = useQuery(applicationsQueryOptions);
  const ownersQuery = useQuery(serviceAccountOwnersQueryOptions);
  const createMutation = useMutation(createServiceAccountMutationOptions());
  const createCredentialMutation = useMutation(createServiceAccountCredentialMutationOptions());
  const rotateCredentialMutation = useMutation(rotateServiceAccountCredentialMutationOptions());
  const credentialStatusMutation = useMutation(setServiceAccountCredentialStatusMutationOptions());
  const deleteCredentialMutation = useMutation(deleteServiceAccountCredentialMutationOptions());
  const updateMutation = useMutation(updateServiceAccountMutationOptions());
  const transferMutation = useMutation(transferServiceAccountMutationOptions());
  const statusMutation = useMutation(setServiceAccountStatusMutationOptions());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [ownerType, setOwnerType] = useState<"user" | "team">("user");
  const [ownerId, setOwnerId] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [secretNotice, setSecretNotice] = useState<CreatedCredentialSecret>();

  async function refresh(message?: string, accountId?: string) {
    await queryClient.invalidateQueries({ queryKey: apiQueryKeys.serviceAccounts });
    if (accountId) {
      await queryClient.invalidateQueries({
        queryKey: apiQueryKeys.serviceAccountCredentials(accountId),
      });
    }
    if (message) setStatus(message);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setSecretNotice(undefined);
    setBusyId("create");
    try {
      await createMutation.mutateAsync({
        description: description || undefined,
        name,
        ownerId,
        ownerType,
      });
      setName("");
      setDescription("");
      setOwnerId("");
      await refresh("Service account created.");
    } catch (submitError) {
      setError(formatApiError(submitError));
    } finally {
      setBusyId(undefined);
    }
  }

  async function runAccountAction(id: string, action: () => Promise<unknown>, message: string) {
    setBusyId(id);
    setError(undefined);
    setStatus(undefined);
    try {
      const result = await action();
      await refresh(message, id);
      return result;
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusyId(undefined);
    }
  }

  const users = ownersQuery.data?.users ?? [];
  const teams = ownersQuery.data?.teams ?? [];
  const accounts = accountsQuery.data?.serviceAccounts ?? [];
  const applications = applicationsQuery.data?.applications ?? [];

  return (
    <AdminLayout
      activePath="/admin/service-accounts"
      description="Service Accounts represent non-human principals. Manage ownership and application-scoped OAuth credentials here."
      eyebrow="Principals / Non-human"
      title="Give automation a responsible owner."
    >
      <div className="space-y-8">
        <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
          <h2 className="text-xl font-semibold text-kumo-strong">New service account</h2>
          <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={submit}>
            <Input
              id="service-name"
              label="Name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <Input
              id="service-description"
              label="Description (optional)"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            <Select
              items={[
                { label: "User", value: "user" },
                { label: "Team", value: "team" },
              ]}
              label="Owner type"
              onValueChange={(value) => {
                const nextType = value === "team" ? "team" : "user";
                setOwnerType(nextType);
                setOwnerId("");
              }}
              value={ownerType}
            />
            <Select
              items={
                ownerType === "user"
                  ? users.map((user) => ({
                      label: user.name,
                      value: user.id,
                    }))
                  : teams.map((team) => ({ label: team.name, value: team.id }))
              }
              label="Owner"
              onValueChange={(value) => setOwnerId(value ?? "")}
              placeholder="Choose an owner"
              required
              value={ownerId || null}
            />
            <div className="lg:col-span-2">
              <Button
                aria-busy={busyId === "create"}
                disabled={busyId !== undefined || !ownerId}
                type="submit"
                variant="primary"
              >
                Create service account
              </Button>
            </div>
          </form>
        </LayerCard>
        {accountsQuery.isLoading || ownersQuery.isLoading ? (
          <AdminStatus>Loading service accounts...</AdminStatus>
        ) : null}
        {accountsQuery.isError ? (
          <AdminError>{formatApiError(accountsQuery.error)}</AdminError>
        ) : null}
        {ownersQuery.isError ? <AdminError>{formatApiError(ownersQuery.error)}</AdminError> : null}
        {applicationsQuery.isError ? (
          <AdminError>{formatApiError(applicationsQuery.error)}</AdminError>
        ) : null}
        {error ? <AdminError>{error}</AdminError> : null}
        {status ? <AdminStatus>{status}</AdminStatus> : null}
        {secretNotice ? (
          <LayerCard
            aria-live="polite"
            className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6"
            role="status"
          >
            <h2 className="text-lg font-semibold text-kumo-strong">Credential secret</h2>
            <p className="mt-1 text-sm text-kumo-subtle">
              This secret is shown once. Store it securely before leaving this page.
            </p>
            <code className="mt-4 block overflow-x-auto rounded-md bg-kumo-base p-3 text-sm text-kumo-strong">
              {secretNotice.clientSecret}
            </code>
            <p className="mt-2 text-xs text-kumo-subtle">Client ID: {secretNotice.clientId}</p>
          </LayerCard>
        ) : null}
        <Grid gap="sm" variant="2up">
          {accounts.map((account) => (
            <ServiceAccountCard
              account={account}
              busy={busyId === account.id}
              key={account.id}
              onStatus={() => {
                const nextStatus = account.status === "active" ? "disabled" : "active";
                void runAccountAction(
                  account.id,
                  () => statusMutation.mutateAsync({ id: account.id, status: nextStatus }),
                  nextStatus === "active"
                    ? "Service account enabled."
                    : "Service account disabled.",
                );
              }}
              onTransfer={(body) =>
                runAccountAction(
                  account.id,
                  () => transferMutation.mutateAsync({ body, id: account.id }),
                  "Ownership transferred.",
                )
              }
              onUpdate={(body) =>
                runAccountAction(
                  account.id,
                  () => updateMutation.mutateAsync({ body, id: account.id }),
                  "Service account updated.",
                )
              }
              teams={teams}
              users={users}
              applications={applications}
              onCredentialCreate={async (body) => {
                const result = await runAccountAction(
                  account.id,
                  () => createCredentialMutation.mutateAsync({ body, id: account.id }),
                  "OAuth credential created.",
                );
                if (!isCreatedCredential(result)) return;
                const created = result;
                setSecretNotice({ clientId: created.clientId, clientSecret: created.clientSecret });
              }}
              onCredentialRotate={async (clientId) => {
                const result = await runAccountAction(
                  account.id,
                  () => rotateCredentialMutation.mutateAsync({ clientId, id: account.id }),
                  "OAuth credential rotated.",
                );
                if (!isCreatedCredential(result)) return;
                const created = result;
                setSecretNotice({ clientId: created.clientId, clientSecret: created.clientSecret });
              }}
              onCredentialStatus={(clientId, nextStatus) =>
                runAccountAction(
                  account.id,
                  () =>
                    credentialStatusMutation.mutateAsync({
                      clientId,
                      id: account.id,
                      status: nextStatus,
                    }),
                  nextStatus === "active"
                    ? "OAuth credential enabled."
                    : "OAuth credential disabled.",
                )
              }
              onCredentialDelete={(clientId) =>
                runAccountAction(
                  account.id,
                  () => deleteCredentialMutation.mutateAsync({ clientId, id: account.id }),
                  "OAuth credential deleted.",
                )
              }
            />
          ))}
        </Grid>
      </div>
    </AdminLayout>
  );
}

function ServiceAccountCard({
  account,
  busy,
  onStatus,
  onTransfer,
  onUpdate,
  teams,
  users,
  applications,
  onCredentialCreate,
  onCredentialRotate,
  onCredentialStatus,
  onCredentialDelete,
}: Readonly<{
  account: ServiceAccount;
  busy: boolean;
  onStatus: () => void;
  onTransfer: (body: { ownerId: string; ownerType: "user" | "team" }) => void;
  onUpdate: (body: { description?: string | null; name?: string }) => void;
  teams: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string }>;
  applications: Application[];
  onCredentialCreate: (body: { applicationId: string; name: string }) => Promise<void>;
  onCredentialRotate: (clientId: string) => Promise<void>;
  onCredentialStatus: (clientId: string, status: "active" | "disabled") => void;
  onCredentialDelete: (clientId: string) => void;
}>) {
  const [name, setName] = useState(account.name);
  const [description, setDescription] = useState(account.description ?? "");
  const [ownerType, setOwnerType] = useState<"user" | "team">(account.owner.type);
  const [ownerId, setOwnerId] = useState(account.owner.id);
  const credentialsQuery = useQuery(serviceAccountCredentialsQueryOptions(account.id));
  const [applicationId, setApplicationId] = useState("");
  const [credentialName, setCredentialName] = useState("");

  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-kumo-strong">{account.name}</h2>
          <p className="mt-1 text-sm text-kumo-subtle">{account.description || "No description"}</p>
        </div>
        <StatusPill status={account.status} />
      </div>
      <form
        className="mt-5 grid gap-3 border-t border-kumo-hairline pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdate({ description: description || null, name });
        }}
      >
        <Input
          id={"service-name-" + account.id}
          label="Name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <Input
          id={"service-description-" + account.id}
          label="Description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy} type="submit" variant="ghost">
            Save details
          </Button>
          <Button disabled={busy} onClick={onStatus} type="button" variant="ghost">
            {account.status === "active" ? "Disable" : "Enable"}
          </Button>
        </div>
      </form>
      <div className="mt-5 border-t border-kumo-hairline pt-5">
        <p className="text-sm text-kumo-subtle">
          Current owner: <span className="font-medium text-kumo-strong">{account.owner.label}</span>{" "}
          ({account.owner.type})
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (ownerId) onTransfer({ ownerId, ownerType });
          }}
        >
          <Select
            items={[
              { label: "User", value: "user" },
              { label: "Team", value: "team" },
            ]}
            label="Transfer to"
            onValueChange={(value) => {
              const nextType = value === "team" ? "team" : "user";
              setOwnerType(nextType);
              setOwnerId("");
            }}
            value={ownerType}
          />
          <Select
            items={
              ownerType === "user"
                ? users.map((user) => ({
                    label: user.name,
                    value: user.id,
                  }))
                : teams.map((team) => ({ label: team.name, value: team.id }))
            }
            label="Owner"
            onValueChange={(value) => setOwnerId(value ?? "")}
            placeholder="Choose an owner"
            required
            value={ownerId || null}
          />
          <Button
            className="sm:col-span-2"
            disabled={busy || !ownerId}
            type="submit"
            variant="primary"
          >
            Transfer ownership
          </Button>
        </form>
      </div>
      <div className="mt-5 border-t border-kumo-hairline pt-5">
        <h3 className="text-lg font-semibold text-kumo-strong">OAuth credentials</h3>
        <p className="mt-1 text-sm text-kumo-subtle">
          Credentials are scoped to one Application. Secrets are only returned when created or
          rotated.
        </p>
        <form
          className="mt-4 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (applicationId && credentialName.trim()) {
              void onCredentialCreate({ applicationId, name: credentialName });
              setCredentialName("");
            }
          }}
        >
          <Select
            items={applications
              .filter((application) => application.status === "active")
              .map((application) => ({ label: application.name, value: application.id }))}
            label="Application"
            onValueChange={(value) => setApplicationId(value ?? "")}
            placeholder="Choose an application"
            required
            value={applicationId || null}
          />
          <Input
            id={`credential-name-${account.id}`}
            label="Credential name"
            onChange={(event) => setCredentialName(event.target.value)}
            required
            value={credentialName}
          />
          <Button
            className="sm:col-span-2"
            disabled={busy || !applicationId || !credentialName.trim()}
            type="submit"
            variant="primary"
          >
            Create OAuth credential
          </Button>
        </form>
        {credentialsQuery.isLoading ? (
          <p className="mt-4 text-sm text-kumo-subtle">Loading credentials...</p>
        ) : null}
        {credentialsQuery.isError ? (
          <p className="mt-4 text-sm text-kumo-danger">{formatApiError(credentialsQuery.error)}</p>
        ) : null}
        <div className="mt-4 space-y-3">
          {(credentialsQuery.data?.credentials ?? []).map((credential) => (
            <div className="rounded-md border border-kumo-hairline p-3" key={credential.clientId}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-kumo-strong">{credential.name}</p>
                  <p className="mt-1 text-sm text-kumo-subtle">
                    Application: {credential.applicationName}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-kumo-subtle">
                    {credential.clientId}
                  </p>
                </div>
                <StatusPill status={credential.disabled ? "disabled" : "active"} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={busy}
                  onClick={() => void onCredentialRotate(credential.clientId)}
                  type="button"
                  variant="ghost"
                >
                  Rotate secret
                </Button>
                <Button
                  disabled={busy}
                  onClick={() =>
                    onCredentialStatus(
                      credential.clientId,
                      credential.disabled ? "active" : "disabled",
                    )
                  }
                  type="button"
                  variant="ghost"
                >
                  {credential.disabled ? "Enable" : "Disable"}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => onCredentialDelete(credential.clientId)}
                  type="button"
                  variant="ghost"
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LayerCard>
  );
}

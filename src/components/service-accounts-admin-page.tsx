import { Button, Grid, Input, LayerCard, Select } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatApiError, type ServiceAccount } from "../lib/api-client";
import {
  apiQueryKeys,
  createServiceAccountMutationOptions,
  serviceAccountsQueryOptions,
  setServiceAccountStatusMutationOptions,
  teamsQueryOptions,
  transferServiceAccountMutationOptions,
  updateServiceAccountMutationOptions,
  usersQueryOptions,
} from "../lib/api-query-options";
import { AdminError, AdminLayout, AdminStatus, StatusPill } from "./admin-layout";

export function ServiceAccountsAdminPage() {
  const queryClient = useQueryClient();
  const accountsQuery = useQuery(serviceAccountsQueryOptions);
  const usersQuery = useQuery(usersQueryOptions);
  const teamsQuery = useQuery(teamsQueryOptions);
  const createMutation = useMutation(createServiceAccountMutationOptions());
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

  async function refresh(message?: string) {
    await queryClient.invalidateQueries({ queryKey: apiQueryKeys.serviceAccounts });
    if (message) setStatus(message);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
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
      await action();
      await refresh(message);
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusyId(undefined);
    }
  }

  const users = (usersQuery.data?.users ?? []).filter(
    (user) => user.principalId && user.status === "active",
  );
  const teams = (teamsQuery.data?.teams ?? []).filter((team) => team.status === "active");
  const accounts = accountsQuery.data?.serviceAccounts ?? [];

  return (
    <AdminLayout
      activePath="/service-accounts"
      description="Service Accounts represent non-human principals. This screen covers their lifecycle and ownership; OAuth credentials are handled separately."
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
                      value: user.principalId ?? "",
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
        {accountsQuery.isLoading ? <AdminStatus>Loading service accounts...</AdminStatus> : null}
        {accountsQuery.isError ? (
          <AdminError>{formatApiError(accountsQuery.error)}</AdminError>
        ) : null}
        {error ? <AdminError>{error}</AdminError> : null}
        {status ? <AdminStatus>{status}</AdminStatus> : null}
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
}: Readonly<{
  account: ServiceAccount;
  busy: boolean;
  onStatus: () => void;
  onTransfer: (body: { ownerId: string; ownerType: "user" | "team" }) => void;
  onUpdate: (body: { description?: string | null; name?: string }) => void;
  teams: Array<{ id: string; name: string }>;
  users: Array<{ id: string; name: string; principalId: string | null }>;
}>) {
  const [name, setName] = useState(account.name);
  const [description, setDescription] = useState(account.description ?? "");
  const [ownerType, setOwnerType] = useState<"user" | "team">(account.owner.type);
  const [ownerId, setOwnerId] = useState(account.owner.id);

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
                    value: user.principalId ?? "",
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
    </LayerCard>
  );
}

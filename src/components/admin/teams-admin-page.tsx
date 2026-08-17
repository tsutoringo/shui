import { Button, Grid, Input, LayerCard, Select } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { formatApiError, type Team } from "../../lib/api-client";
import {
  addTeamMemberMutationOptions,
  apiQueryKeys,
  createTeamMutationOptions,
  deleteTeamMutationOptions,
  removeTeamMemberMutationOptions,
  setTeamStatusMutationOptions,
  teamsQueryOptions,
  updateTeamMutationOptions,
  usersQueryOptions,
} from "../../lib/api-query-options";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLayout,
  AdminStatus,
  StatusPill,
} from "./admin-layout";

export function TeamsAdminPage() {
  const queryClient = useQueryClient();
  const teamsQuery = useQuery(teamsQueryOptions);
  const usersQuery = useQuery(usersQueryOptions);
  const createMutation = useMutation(createTeamMutationOptions());
  const updateMutation = useMutation(updateTeamMutationOptions());
  const statusMutation = useMutation(setTeamStatusMutationOptions());
  const deleteMutation = useMutation(deleteTeamMutationOptions());
  const addMemberMutation = useMutation(addTeamMemberMutationOptions());
  const removeMemberMutation = useMutation(removeTeamMemberMutationOptions());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  async function refresh(message?: string) {
    await queryClient.invalidateQueries({ queryKey: apiQueryKeys.teams });
    await queryClient.invalidateQueries({ queryKey: apiQueryKeys.users });
    if (message) setStatus(message);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setStatus(undefined);
    setBusyId("create");
    try {
      await createMutation.mutateAsync({ description: description || undefined, name });
      setName("");
      setDescription("");
      await refresh("Team created.");
    } catch (submitError) {
      setError(formatApiError(submitError));
    } finally {
      setBusyId(undefined);
    }
  }

  async function runTeamAction(id: string, action: () => Promise<unknown>, message: string) {
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

  const teams = teamsQuery.data?.teams ?? [];
  const users = usersQuery.data?.users ?? [];

  return (
    <AdminLayout
      activePath="/admin/teams"
      description="Teams contain human Users only. Membership is explicit, flat, and easy to audit; a disabled team no longer represents an active group."
      eyebrow="Principals / Teams"
      title="Put people in useful groups."
    >
      <div className="space-y-8">
        <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
          <h2 className="text-xl font-semibold text-kumo-strong">New team</h2>
          <form
            className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
            onSubmit={submit}
          >
            <Input
              id="team-name"
              label="Team name"
              onChange={(event) => setName(event.target.value)}
              required
              value={name}
            />
            <Input
              id="team-description"
              label="Description (optional)"
              onChange={(event) => setDescription(event.target.value)}
              value={description}
            />
            <Button
              aria-busy={busyId === "create"}
              disabled={busyId !== undefined}
              type="submit"
              variant="primary"
            >
              Create team
            </Button>
          </form>
        </LayerCard>
        {teamsQuery.isLoading || usersQuery.isLoading ? (
          <AdminStatus>Loading teams...</AdminStatus>
        ) : null}
        {teamsQuery.isError ? <AdminError>{formatApiError(teamsQuery.error)}</AdminError> : null}
        {usersQuery.isError ? <AdminError>{formatApiError(usersQuery.error)}</AdminError> : null}
        {error ? <AdminError>{error}</AdminError> : null}
        {status ? <AdminStatus>{status}</AdminStatus> : null}
        <Grid gap="sm" variant="2up">
          {teams.map((team) => (
            <TeamCard
              busy={busyId === team.id}
              key={team.id}
              onAddMember={(userId) =>
                runTeamAction(
                  team.id,
                  () => addMemberMutation.mutateAsync({ body: { userId }, teamId: team.id }),
                  "Member added.",
                )
              }
              onDelete={() =>
                runTeamAction(team.id, () => deleteMutation.mutateAsync(team.id), "Team deleted.")
              }
              onRemoveMember={(userId) =>
                runTeamAction(
                  team.id,
                  () => removeMemberMutation.mutateAsync({ teamId: team.id, userId }),
                  "Member removed.",
                )
              }
              onStatus={() => {
                const nextStatus = team.status === "active" ? "disabled" : "active";
                void runTeamAction(
                  team.id,
                  () => statusMutation.mutateAsync({ id: team.id, status: nextStatus }),
                  nextStatus === "active" ? "Team enabled." : "Team disabled.",
                );
              }}
              onUpdate={(body) =>
                runTeamAction(
                  team.id,
                  () => updateMutation.mutateAsync({ body, id: team.id }),
                  "Team updated.",
                )
              }
              team={team}
              users={users.filter((user) => user.principalId && user.status === "active")}
            />
          ))}
        </Grid>
      </div>
    </AdminLayout>
  );
}

function TeamCard({
  busy,
  onAddMember,
  onDelete,
  onRemoveMember,
  onStatus,
  onUpdate,
  team,
  users,
}: Readonly<{
  busy: boolean;
  onAddMember: (userId: string) => void;
  onDelete: () => void;
  onRemoveMember: (userId: string) => void;
  onStatus: () => void;
  onUpdate: (body: { description?: string | null; name?: string }) => void;
  team: Team;
  users: Array<{ id: string; name: string; principalId: string | null }>;
}>) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? "");
  const [selectedUserId, setSelectedUserId] = useState("");
  const memberIds = new Set(team.members.map((member) => member.id));
  const availableUsers = users.filter((user) => !memberIds.has(user.id));

  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="truncate text-xl font-semibold text-kumo-strong">{team.name}</h2>
          <p className="mt-1 text-sm text-kumo-subtle">{team.description || "No description"}</p>
        </div>
        <StatusPill status={team.status} />
      </div>
      <form
        className="mt-5 grid gap-3 border-t border-kumo-hairline pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          onUpdate({ description: description || null, name });
        }}
      >
        <Input
          id={"team-name-" + team.id}
          label="Name"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
        <Input
          id={"team-description-" + team.id}
          label="Description"
          onChange={(event) => setDescription(event.target.value)}
          value={description}
        />
        <div className="flex flex-wrap gap-3">
          <Button aria-busy={busy} disabled={busy} type="submit" variant="ghost">
            Save details
          </Button>
          <Button aria-busy={busy} disabled={busy} onClick={onStatus} type="button" variant="ghost">
            {team.status === "active" ? "Disable team" : "Enable team"}
          </Button>
          <AdminConfirmDialog
            confirmLabel="Delete team"
            description="This will remove the team and all of its membership records."
            onConfirm={onDelete}
            title={`Delete ${team.name}?`}
            trigger={
              <Button
                aria-busy={busy}
                disabled={busy}
                type="button"
                variant="secondary-destructive"
              >
                Delete team
              </Button>
            }
          />
        </div>
      </form>
      <div className="mt-6 border-t border-kumo-hairline pt-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium text-kumo-strong">Members</h3>
          <span className="text-sm text-kumo-subtle">{team.memberCount}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {team.members.map((member) => (
            <li
              className="flex items-center justify-between gap-3 rounded-lg bg-kumo-recessed px-3 py-2 text-sm"
              key={member.id}
            >
              <span className="min-w-0">
                <span className="block truncate text-kumo-strong">{member.name}</span>
                <span className="block truncate text-xs text-kumo-subtle">{member.email}</span>
              </span>
              <Button
                aria-label={"Remove " + member.name + " from " + team.name}
                disabled={busy}
                onClick={() => onRemoveMember(member.id)}
                type="button"
                variant="ghost"
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
        {team.status === "active" && availableUsers.length > 0 ? (
          <form
            className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              if (selectedUserId) onAddMember(selectedUserId);
            }}
          >
            <Select
              className="min-w-0 flex-1"
              items={availableUsers.map((user) => ({ label: user.name, value: user.id }))}
              label="Add a human user"
              onValueChange={(value) => setSelectedUserId(value ?? "")}
              placeholder="Choose a user"
              value={selectedUserId || null}
            />
            <Button disabled={busy || !selectedUserId} type="submit" variant="primary">
              Add member
            </Button>
          </form>
        ) : null}
      </div>
    </LayerCard>
  );
}

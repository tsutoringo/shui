import { Button, Grid, LayerCard, Select } from "@cloudflare/kumo";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { SystemRole, User } from "~/features/system-roles/api/client";
import { formatApiError } from "~/shared/api/errors";
import { adminAccessQueryOptions } from "~/features/admin/api/queries";
import {
  grantUserRoleMutationOptions,
  revokeUserRoleMutationOptions,
  systemRoleQueryKeys,
  systemRolesQueryOptions,
  userQueryKeys,
  usersQueryOptions,
} from "~/features/system-roles/api/queries";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLayout,
  AdminStatus,
} from "~/features/admin/components/admin-layout";

export function SystemRolesAdminPage() {
  const queryClient = useQueryClient();
  const rolesQuery = useQuery(systemRolesQueryOptions);
  const usersQuery = useQuery(usersQueryOptions);
  const accessQuery = useQuery(adminAccessQueryOptions);
  const grantMutation = useMutation(grantUserRoleMutationOptions());
  const revokeMutation = useMutation(revokeUserRoleMutationOptions());
  const [userId, setUserId] = useState("");
  const [roleKey, setRoleKey] = useState("");
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  async function refresh(message?: string) {
    await queryClient.invalidateQueries({ queryKey: systemRoleQueryKeys.all });
    await queryClient.invalidateQueries({ queryKey: userQueryKeys.all });
    if (message) setStatus(message);
  }

  async function grant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userId || !roleKey) return;
    setBusyId(userId);
    setError(undefined);
    setStatus(undefined);
    try {
      await grantMutation.mutateAsync({ id: userId, roleKey });
      await refresh("System role granted.");
    } catch (grantError) {
      setError(formatApiError(grantError));
    } finally {
      setBusyId(undefined);
    }
  }

  async function revoke(user: User, role: string) {
    setBusyId(user.id);
    setError(undefined);
    setStatus(undefined);
    try {
      await revokeMutation.mutateAsync({ id: user.id, roleKey: role });
      await refresh("System role revoked.");
    } catch (revokeError) {
      setError(formatApiError(revokeError));
    } finally {
      setBusyId(undefined);
    }
  }

  const roles = rolesQuery.data?.roles ?? [];
  const users = (usersQuery.data?.users ?? []).filter(
    (user) => user.principalId && user.status !== "unmanaged",
  );
  const selectedRole = roles.find((role) => role.key === roleKey);
  const canManageRoles = accessQuery.data?.permissions.includes("*") ?? false;

  return (
    <AdminLayout
      activePath="/admin/system-roles"
      description="System Roles operate Shui itself. The root role is recovery-critical; the API refuses to remove or disable the last active root User."
      eyebrow="Authorization"
      title="Make responsibility explicit."
    >
      <div className="space-y-8">
        {canManageRoles ? (
          <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
            <h2 className="text-xl font-semibold text-kumo-strong">Grant a system role</h2>
            <form
              className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
              onSubmit={grant}
            >
              <Select
                items={users.map((user) => ({
                  label: `${user.name} · ${user.email}`,
                  value: user.id,
                }))}
                label="User"
                onValueChange={(value) => setUserId(value ?? "")}
                placeholder="Choose a user"
                required
                value={userId || null}
              />
              <Select
                items={roles.map((role) => ({ label: role.name, value: role.key }))}
                label="System role"
                onValueChange={(value) => setRoleKey(value ?? "")}
                placeholder="Choose a role"
                required
                value={roleKey || null}
              />
              <Button
                aria-busy={busyId === userId}
                disabled={!userId || !roleKey || busyId !== undefined}
                type="submit"
                variant="primary"
              >
                Grant role
              </Button>
            </form>
            {selectedRole ? (
              <p className="mt-4 text-sm leading-6 text-kumo-subtle">{selectedRole.description}</p>
            ) : null}
          </LayerCard>
        ) : null}
        {!canManageRoles ? (
          <AdminStatus>You can review role assignments, but only root can change them.</AdminStatus>
        ) : null}
        {rolesQuery.isLoading || usersQuery.isLoading ? (
          <AdminStatus>Loading role assignments...</AdminStatus>
        ) : null}
        {rolesQuery.isError ? <AdminError>{formatApiError(rolesQuery.error)}</AdminError> : null}
        {usersQuery.isError ? <AdminError>{formatApiError(usersQuery.error)}</AdminError> : null}
        {error ? <AdminError>{error}</AdminError> : null}
        {status ? <AdminStatus>{status}</AdminStatus> : null}
        <Grid gap="sm" variant="3up">
          {roles.map((role) => (
            <RoleCard
              busyId={busyId}
              canManageRoles={canManageRoles}
              key={role.key}
              onRevoke={revoke}
              role={role}
              users={users}
            />
          ))}
        </Grid>
      </div>
    </AdminLayout>
  );
}

function RoleCard({
  busyId,
  canManageRoles,
  onRevoke,
  role,
  users,
}: Readonly<{
  busyId: string | undefined;
  canManageRoles: boolean;
  onRevoke: (user: User, role: string) => void;
  role: SystemRole;
  users: User[];
}>) {
  const holders = users.filter((user) => user.roles.includes(role.key));
  return (
    <LayerCard className="bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-kumo-strong">{role.name}</h2>
          <p className="mt-1 font-mono text-xs text-(--tangerine)">{role.key}</p>
        </div>
        <span className="text-sm text-kumo-subtle">{role.activeGrantCount} active</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-kumo-subtle">{role.description}</p>
      <div className="mt-5 border-t border-kumo-hairline pt-4">
        <h3 className="text-sm font-medium text-kumo-strong">Current holders</h3>
        {holders.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {holders.map((user) => (
              <li className="flex items-center justify-between gap-3 text-sm" key={user.id}>
                <span className="min-w-0 truncate text-kumo-subtle">{user.name}</span>
                {canManageRoles ? (
                  <AdminConfirmDialog
                    confirmLabel="Revoke role"
                    description="The user will immediately lose this system role."
                    onConfirm={() => onRevoke(user, role.key)}
                    title={`Revoke ${role.name} from ${user.name}?`}
                    trigger={
                      <Button
                        aria-label={"Revoke " + role.name + " from " + user.name}
                        disabled={busyId === user.id}
                        type="button"
                        variant="secondary-destructive"
                      >
                        Revoke
                      </Button>
                    }
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-kumo-subtle">No active holders.</p>
        )}
      </div>
    </LayerCard>
  );
}

import { Button, Dialog, Input, LayerCard, Table } from "@cloudflare/kumo";
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  tableFeatures,
  useTable,
  type SortingState,
} from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { formatApiError, type InvitationCreated, type User } from "../lib/api-client";
import {
  adminAccessQueryOptions,
  apiQueryKeys,
  createInvitationMutationOptions,
  repairUserMutationOptions,
  setUserStatusMutationOptions,
  usersQueryOptions,
} from "../lib/api-query-options";
import { hasAdminPermission } from "../lib/admin-policy";
import {
  AdminConfirmDialog,
  AdminError,
  AdminLayout,
  AdminStatus,
  StatusPill,
} from "./admin-layout";

const EMPTY_USERS: User[] = [];
const userTableFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString },
  sortFns: { alphanumeric: sortFn_alphanumeric },
});
const userColumnHelper = createColumnHelper<typeof userTableFeatures, User>();

export function UsersAdminPage() {
  const queryClient = useQueryClient();
  const usersQuery = useQuery(usersQueryOptions);
  const accessQuery = useQuery(adminAccessQueryOptions);
  const repairMutation = useMutation(repairUserMutationOptions());
  const statusMutation = useMutation(setUserStatusMutationOptions());
  const [busyId, setBusyId] = useState<string>();
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  async function runAction(id: string, action: () => Promise<unknown>, message: string) {
    setBusyId(id);
    setError(undefined);
    setStatus(undefined);
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: apiQueryKeys.users });
      setStatus(message);
    } catch (actionError) {
      setError(formatApiError(actionError));
    } finally {
      setBusyId(undefined);
    }
  }

  const users = usersQuery.data?.users ?? EMPTY_USERS;
  const canInvite = hasAdminPermission(accessQuery.data, "users:write");

  return (
    <AdminLayout
      activePath="/admin/users"
      description="Human identities are the people who can sign in to Shui. Repairing a mapping restores the domain identity without creating a second Better Auth user."
      eyebrow="Principals"
      title="Know who is in the room."
    >
      <div className="space-y-6">
        {canInvite ? (
          <div className="flex justify-end">
            <InviteUserDialog />
          </div>
        ) : null}
        {usersQuery.isLoading ? <AdminStatus>Loading principals...</AdminStatus> : null}
        {usersQuery.isError ? <AdminError>{formatApiError(usersQuery.error)}</AdminError> : null}
        {error ? <AdminError>{error}</AdminError> : null}
        {status ? <AdminStatus>{status}</AdminStatus> : null}
        {!usersQuery.isLoading && !usersQuery.isError && users.length === 0 ? (
          <LayerCard className="bg-kumo-elevated p-6 ring ring-kumo-line">
            <h2 className="text-lg font-semibold text-kumo-strong">No users yet</h2>
            <p className="mt-2 text-sm leading-6 text-kumo-subtle">
              Create an invitation to add the first member after setup.
            </p>
          </LayerCard>
        ) : null}
        {users.length > 0 ? (
          <UsersTable
            busyId={busyId}
            onRepair={(user) =>
              void runAction(
                user.id,
                () => repairMutation.mutateAsync(user.id),
                "Principal repaired.",
              )
            }
            onToggleStatus={(user) => {
              const nextStatus = user.status === "active" ? "disabled" : "active";
              void runAction(
                user.id,
                () => statusMutation.mutateAsync({ id: user.id, status: nextStatus }),
                nextStatus === "disabled" ? "User disabled." : "User enabled.",
              );
            }}
            users={users}
          />
        ) : null}
      </div>
    </AdminLayout>
  );
}

function UsersTable({
  busyId,
  onRepair,
  onToggleStatus,
  users,
}: Readonly<{
  busyId: string | undefined;
  onRepair: (user: User) => void;
  onToggleStatus: (user: User) => void;
  users: User[];
}>) {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns = useMemo(
    () =>
      userColumnHelper.columns([
        userColumnHelper.accessor("name", {
          cell: ({ getValue }) => (
            <span className="font-medium text-kumo-strong">{getValue()}</span>
          ),
          header: "Name",
          sortFn: "alphanumeric",
        }),
        userColumnHelper.accessor("email", {
          cell: ({ getValue }) => <span className="break-all">{getValue()}</span>,
          header: "Email",
          sortFn: "alphanumeric",
        }),
        userColumnHelper.accessor("status", {
          cell: ({ getValue }) => <StatusPill status={getValue()} />,
          header: "Status",
          sortFn: "alphanumeric",
        }),
        userColumnHelper.accessor((user) => user.roles.join(", "), {
          cell: ({ getValue }) => getValue() || "None",
          header: "System roles",
          id: "roles",
          sortFn: "alphanumeric",
        }),
        userColumnHelper.accessor((user) => user.teams.length, {
          cell: ({ getValue }) => getValue() || "None",
          header: "Teams",
          id: "teams",
          sortFn: "alphanumeric",
        }),
        userColumnHelper.accessor("createdAt", {
          cell: ({ getValue }) => new Date(getValue()).toLocaleDateString(),
          header: "Joined",
          sortFn: "alphanumeric",
        }),
        userColumnHelper.display({
          cell: ({ row }) => (
            <UserActions
              busy={busyId === row.original.id}
              onRepair={() => onRepair(row.original)}
              onToggleStatus={() => onToggleStatus(row.original)}
              user={row.original}
            />
          ),
          enableGlobalFilter: false,
          enableSorting: false,
          header: "Actions",
          id: "actions",
        }),
      ]),
    [busyId, onRepair, onToggleStatus],
  );
  const table = useTable({
    columns,
    data: users,
    features: userTableFeatures,
    globalFilterFn: "includesString",
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    state: { globalFilter, sorting },
  });
  const rows = table.getRowModel().rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Input
          className="w-full sm:max-w-sm"
          id="users-search"
          label="Search users"
          onChange={(event) => setGlobalFilter(event.target.value)}
          placeholder="Search by name or email"
          type="search"
          value={globalFilter}
        />
        <p aria-live="polite" className="text-sm text-kumo-subtle">
          {rows.length} of {users.length} users
        </p>
      </div>
      <LayerCard className="overflow-hidden bg-kumo-elevated p-0 ring ring-kumo-line">
        <div className="overflow-x-auto">
          <Table className="min-w-240">
            <Table.Header>
              {table.getHeaderGroups().map((headerGroup) => (
                <Table.Row key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    const toggleSorting = header.column.getToggleSortingHandler();
                    const sortLabel =
                      sorted === "asc"
                        ? "Sorted ascending"
                        : sorted === "desc"
                          ? "Sorted descending"
                          : "Not sorted";

                    return (
                      <Table.Head
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : undefined
                        }
                        key={header.id}
                      >
                        {header.isPlaceholder ? null : toggleSorting ? (
                          <Button
                            aria-label={`Sort by ${header.column.id}. ${sortLabel}`}
                            className="justify-start px-2"
                            onClick={toggleSorting}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            <table.FlexRender header={header} />
                            <span aria-hidden="true" className="text-kumo-subtle">
                              {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
                            </span>
                          </Button>
                        ) : (
                          <table.FlexRender header={header} />
                        )}
                      </Table.Head>
                    );
                  })}
                </Table.Row>
              ))}
            </Table.Header>
            <Table.Body>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <Table.Row key={row.id}>
                    {row.getAllCells().map((cell) => (
                      <Table.Cell key={cell.id}>
                        <table.FlexRender cell={cell} />
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))
              ) : (
                <Table.Row>
                  <Table.Cell className="text-center text-kumo-subtle" colSpan={columns.length}>
                    No users match this search.
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
      </LayerCard>
    </div>
  );
}

function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [created, setCreated] = useState<InvitationCreated>();
  const invitationMutation = useMutation(createInvitationMutationOptions());

  const invitationUrl =
    created && typeof window !== "undefined"
      ? `${window.location.origin}/invite/${encodeURIComponent(created.token)}`
      : undefined;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setEmail("");
      setName("");
      setError(undefined);
      setCopied(false);
      setCreated(undefined);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setCopied(false);
    try {
      const invitation = await invitationMutation.mutateAsync({
        email,
        name: name || undefined,
      });
      setCreated(invitation);
    } catch (submitError) {
      setError(formatApiError(submitError));
    }
  }

  async function copyInvitationLink() {
    if (!invitationUrl) return;
    if (typeof navigator === "undefined" || !navigator.clipboard) {
      setError("The invitation link could not be copied. Copy it manually instead.");
      return;
    }

    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopied(true);
      setError(undefined);
    } catch {
      setError("The invitation link could not be copied. Copy it manually instead.");
    }
  }

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open}>
      <Dialog.Trigger
        render={(props) => (
          <Button {...props} type="button" variant="primary">
            Invite user
          </Button>
        )}
      />
      <Dialog className="p-6" size="lg">
        {created ? (
          <>
            <Dialog.Title className="text-lg font-semibold text-kumo-strong">
              Invitation created
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-kumo-subtle">
              Send this single-use link to the invited person. It expires automatically after seven
              days.
            </Dialog.Description>
            <div className="mt-5 bg-kumo-recessed p-4 ring ring-kumo-line">
              <p className="text-sm font-medium text-kumo-strong">Invitation link</p>
              <output
                aria-label="Invitation link"
                className="mt-3 block break-all font-mono text-sm leading-6 text-kumo-strong"
              >
                {invitationUrl ?? "Preparing link..."}
              </output>
              <p className="mt-3 text-sm leading-6 text-kumo-subtle">
                Expires {new Date(created.expiresAt).toLocaleString()}.
              </p>
            </div>
            {created.deliveryPending ? (
              <p className="mt-4 text-sm leading-6 text-kumo-subtle" role="status">
                Email delivery is pending. Use this link or send it through an approved channel.
              </p>
            ) : null}
            {error ? (
              <p className="mt-4 text-sm text-(--m1-error)" role="alert">
                {error}
              </p>
            ) : null}
            {copied ? (
              <p className="mt-4 text-sm text-kumo-success" role="status">
                Invitation link copied.
              </p>
            ) : null}
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close
                render={(props) => (
                  <Button {...props} type="button" variant="secondary">
                    Close
                  </Button>
                )}
              />
              <Button
                disabled={!invitationUrl}
                onClick={() => void copyInvitationLink()}
                type="button"
                variant="primary"
              >
                Copy invitation link
              </Button>
            </div>
          </>
        ) : (
          <>
            <Dialog.Title className="text-lg font-semibold text-kumo-strong">
              Invite a user
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-sm leading-6 text-kumo-subtle">
              The recipient must use this exact email address. The invitation expires after seven
              days.
            </Dialog.Description>
            <form className="mt-5 space-y-4" onSubmit={submit}>
              <Input
                aria-describedby={error ? "invite-user-error" : undefined}
                aria-invalid={error ? true : undefined}
                autoComplete="email"
                id="invite-user-email"
                label="Email address"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              <Input
                autoComplete="name"
                id="invite-user-name"
                label="Name (optional)"
                name="name"
                onChange={(event) => setName(event.target.value)}
                value={name}
              />
              {error ? (
                <p className="text-sm text-(--m1-error)" id="invite-user-error" role="alert">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <Dialog.Close
                  render={(props) => (
                    <Button
                      {...props}
                      disabled={invitationMutation.isPending}
                      type="button"
                      variant="secondary"
                    >
                      Cancel
                    </Button>
                  )}
                />
                <Button
                  aria-busy={invitationMutation.isPending}
                  disabled={invitationMutation.isPending}
                  type="submit"
                  variant="primary"
                >
                  {invitationMutation.isPending ? "Creating invitation..." : "Create invitation"}
                </Button>
              </div>
            </form>
          </>
        )}
      </Dialog>
    </Dialog.Root>
  );
}

function UserActions({
  busy,
  onRepair,
  onToggleStatus,
  user,
}: Readonly<{
  busy: boolean;
  onRepair: () => void;
  onToggleStatus: () => void;
  user: User;
}>) {
  const isManaged = user.principalId !== null;

  if (!isManaged) {
    return (
      <Button aria-busy={busy} disabled={busy} onClick={onRepair} type="button" variant="primary">
        Repair principal
      </Button>
    );
  }

  if (user.status === "active") {
    return (
      <AdminConfirmDialog
        description="The user will not be able to sign in until you enable them again."
        onConfirm={onToggleStatus}
        title={`Disable ${user.name}?`}
        trigger={
          <Button aria-busy={busy} disabled={busy} type="button" variant="secondary-destructive">
            Disable user
          </Button>
        }
      />
    );
  }

  return (
    <Button
      aria-busy={busy}
      disabled={busy}
      onClick={onToggleStatus}
      type="button"
      variant="primary"
    >
      Enable user
    </Button>
  );
}

import { Button, Input, LayerCard, Table } from "@cloudflare/kumo";
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

import { formatApiError, type User } from "../lib/api-client";
import {
  apiQueryKeys,
  repairUserMutationOptions,
  setUserStatusMutationOptions,
  usersQueryOptions,
} from "../lib/api-query-options";
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

  return (
    <AdminLayout
      activePath="/users"
      description="Human identities are the people who can sign in to Shui. Repairing a mapping restores the domain identity without creating a second Better Auth user."
      eyebrow="Principals"
      title="Know who is in the room."
    >
      <div className="space-y-6">
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
        <p aria-live="polite" className="text-base text-kumo-subtle">
          {rows.length} of {users.length} users
        </p>
      </div>
      <LayerCard className="overflow-hidden bg-kumo-elevated p-0 ring ring-kumo-line">
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
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

import { Button, Dialog, Input, LayerCard, Link, Select, Table, Tooltip } from "@cloudflare/kumo";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import type { Application } from "~/features/applications/api/client";
import { formatApiError } from "~/shared/api/errors";
import {
  applicationQueryKeys,
  applicationOwnersQueryOptions,
  applicationsQueryOptions,
  createApplicationMutationOptions,
} from "~/features/applications/api/queries";
import {
  AdminError,
  AdminIcon,
  AdminLayout,
  AdminStatus,
  StatusPill,
} from "~/features/admin/components/admin-layout";

export function ApplicationsAdminPage() {
  const applicationsQuery = useQuery(applicationsQueryOptions);

  const applications = applicationsQuery.data?.applications ?? [];

  return (
    <AdminLayout
      activePath="/admin/applications"
      description="Applications define the boundary where assignments, roles, and OIDC clients meet. Access remains explicit: a role grant never creates an assignment."
      eyebrow="Authorization / Applications"
      title="Make every access decision legible."
    >
      <div className="space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-kumo-strong">Application catalog</h2>
            <p className="mt-1 text-sm leading-6 text-kumo-subtle">
              Choose an application to review its settings, roles, clients, and access.
            </p>
          </div>
          <ApplicationCreateDialog />
        </div>

        {applicationsQuery.isLoading ? <AdminStatus>Loading applications...</AdminStatus> : null}
        {applicationsQuery.isError ? (
          <AdminError>{formatApiError(applicationsQuery.error)}</AdminError>
        ) : null}

        {applications.length > 0 ? <ApplicationsTable applications={applications} /> : null}
        {!applicationsQuery.isLoading && applications.length === 0 ? (
          <LayerCard className="bg-kumo-elevated p-6 ring ring-kumo-line">
            <h2 className="text-lg font-semibold text-kumo-strong">No applications yet</h2>
            <p className="mt-2 text-sm leading-6 text-kumo-subtle">
              Create the first application to start assigning people and teams.
            </p>
          </LayerCard>
        ) : null}
      </div>
    </AdminLayout>
  );
}

function ApplicationCreateDialog() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ownersQuery = useQuery(applicationOwnersQueryOptions);
  const createMutation = useMutation(createApplicationMutationOptions());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [resourceIdentifier, setResourceIdentifier] = useState("");
  const [ownerType, setOwnerType] = useState<"user" | "team">("user");
  const [ownerId, setOwnerId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  function reset() {
    setName("");
    setDescription("");
    setResourceIdentifier("");
    setOwnerType("user");
    setOwnerId("");
    setError(undefined);
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen && !busy) reset();
    if (nextOpen) setError(undefined);
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const application = await createMutation.mutateAsync({
        description: description || undefined,
        name,
        ownerId,
        ownerType,
        resourceIdentifier: resourceIdentifier || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all });
      reset();
      setOpen(false);
      await navigate({
        params: { applicationId: application.id },
        to: "/admin/applications/$applicationId",
      });
    } catch (createError) {
      setError(formatApiError(createError));
    } finally {
      setBusy(false);
    }
  }

  const owners = ownersQuery.data;
  const ownerItems =
    ownerType === "user"
      ? (owners?.users ?? []).map((owner) => ({ label: owner.name, value: owner.id }))
      : (owners?.teams ?? []).map((owner) => ({ label: owner.name, value: owner.id }));

  return (
    <Dialog.Root onOpenChange={handleOpenChange} open={open}>
      <Dialog.Trigger
        render={
          <Button type="button" variant="primary">
            New application
          </Button>
        }
      />
      <Dialog className="max-h-[calc(100svh-2rem)] overflow-y-auto p-6" size="lg">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">
          New application
        </Dialog.Title>
        <Dialog.Description className="mt-2 max-w-2xl text-sm leading-6 text-kumo-subtle">
          Resource identifiers are immutable. Leave the field empty to generate one from the current
          Shui issuer.
        </Dialog.Description>
        {ownersQuery.isLoading ? <AdminStatus>Loading owners...</AdminStatus> : null}
        {ownersQuery.isError ? (
          <div className="mt-4">
            <AdminError>{formatApiError(ownersQuery.error)}</AdminError>
          </div>
        ) : null}
        {error ? (
          <div className="mt-4">
            <AdminError>{error}</AdminError>
          </div>
        ) : null}
        <form className="mt-5 grid gap-4 lg:grid-cols-2" onSubmit={create}>
          <Input
            id="application-create-name"
            label="Name"
            onChange={(event) => setName(event.target.value)}
            required
            value={name}
          />
          <Input
            id="application-create-description"
            label="Description (optional)"
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
          <Input
            id="application-create-resource"
            label="Resource identifier (optional)"
            onChange={(event) => setResourceIdentifier(event.target.value)}
            type="url"
            value={resourceIdentifier}
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
            items={ownerItems}
            label="Owner"
            onValueChange={(value) => setOwnerId(value ?? "")}
            placeholder="Choose an owner"
            required
            value={ownerId || null}
          />
          <div className="flex justify-end gap-3 lg:col-span-2">
            <Dialog.Close
              disabled={busy}
              render={(props) => (
                <Button {...props} disabled={busy} type="button" variant="secondary">
                  Cancel
                </Button>
              )}
            />
            <Button aria-busy={busy} disabled={busy} type="submit" variant="primary">
              Create application
            </Button>
          </div>
        </form>
      </Dialog>
    </Dialog.Root>
  );
}

function ApplicationsTable({ applications }: Readonly<{ applications: Application[] }>) {
  return (
    <LayerCard className="overflow-hidden bg-kumo-elevated p-0 ring ring-kumo-line">
      <div className="overflow-x-auto">
        <Table className="min-w-[52rem]">
          <caption className="sr-only">Applications</caption>
          <Table.Header>
            <Table.Row>
              <Table.Head>Application</Table.Head>
              <Table.Head>Status</Table.Head>
              <Table.Head>Owner</Table.Head>
              <Table.Head>Roles</Table.Head>
              <Table.Head>Assignments</Table.Head>
              <Table.Head>OIDC clients</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {applications.map((application) => (
              <Table.Row key={application.id}>
                <Table.Cell className="max-w-[20rem] align-top">
                  <Link className="font-medium" href={`/admin/applications/${application.id}`}>
                    {application.name}
                  </Link>
                </Table.Cell>
                <Table.Cell className="align-top">
                  <StatusPill status={application.status} />
                </Table.Cell>
                <Table.Cell className="align-top">
                  <div className="flex items-center gap-2">
                    <Tooltip content={application.owner.type === "team" ? "Team" : "User"}>
                      <>
                        <span aria-hidden="true" className="text-kumo-subtle">
                          <AdminIcon name={application.owner.type === "team" ? "teams" : "users"} />
                        </span>
                        <span className="sr-only">
                          {application.owner.type === "team" ? "Team" : "User"}
                        </span>
                      </>
                    </Tooltip>
                    <span className="font-medium text-kumo-strong">{application.owner.label}</span>
                  </div>
                </Table.Cell>
                <Table.Cell className="align-top font-medium text-kumo-strong">
                  {application.roleCount}
                </Table.Cell>
                <Table.Cell className="align-top font-medium text-kumo-strong">
                  {application.assignmentCount}
                </Table.Cell>
                <Table.Cell className="align-top font-medium text-kumo-strong">
                  {application.clientCount}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </LayerCard>
  );
}

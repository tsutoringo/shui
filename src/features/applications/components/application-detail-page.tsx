import { Badge, LinkButton, Tabs } from "@cloudflare/kumo";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";

import type { Application } from "~/features/applications/api/client";
import {
  applicationQueryKeys,
  applicationsQueryOptions,
} from "~/features/applications/api/queries";
import { formatApiError } from "~/shared/api/errors";
import {
  AdminError,
  AdminLayout,
  AdminStatus,
  StatusPill,
} from "~/features/admin/components/admin-layout";

type ApplicationTab = "overview" | "settings" | "roles" | "oidc" | "access";

const applicationTabItems = [
  { label: "Overview", value: "overview" },
  { label: "Settings", value: "settings" },
  { label: "Roles", value: "roles" },
  { label: "OIDC clients", value: "oidc" },
  { label: "Access", value: "access" },
] satisfies Array<{ label: string; value: ApplicationTab }>;

type ApplicationDetailContextValue = {
  application: Application;
  onDeleted: () => Promise<void>;
  onRefresh: (message?: string) => Promise<void>;
};

const ApplicationDetailContext = createContext<ApplicationDetailContextValue | null>(null);

export function ApplicationDetailPage({
  applicationId,
  children,
}: Readonly<{ applicationId: string; children: ReactNode }>) {
  const locationPath = useLocation({ select: (location) => location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const applicationsQuery = useQuery(applicationsQueryOptions);
  const [status, setStatus] = useState<string>();
  const application = applicationsQuery.data?.applications.find(
    (candidate) => candidate.id === applicationId,
  );
  const activeTab = applicationTabFromPath(locationPath);

  async function refresh(message?: string) {
    await queryClient.invalidateQueries({ queryKey: applicationQueryKeys.all });
    if (message) setStatus(message);
  }

  async function onDeleted() {
    await navigate({ to: "/admin/applications" });
  }

  function navigateToTab(tab: ApplicationTab) {
    switch (tab) {
      case "overview":
        return navigate({
          params: { applicationId },
          to: "/admin/applications/$applicationId",
        });
      case "settings":
        return navigate({
          params: { applicationId },
          to: "/admin/applications/$applicationId/settings",
        });
      case "roles":
        return navigate({
          params: { applicationId },
          to: "/admin/applications/$applicationId/roles",
        });
      case "oidc":
        return navigate({
          params: { applicationId },
          to: "/admin/applications/$applicationId/oidc",
        });
      case "access":
        return navigate({
          params: { applicationId },
          to: "/admin/applications/$applicationId/access",
        });
    }
  }

  return (
    <AdminLayout
      activePath="/admin/applications"
      breadcrumbLabel={application?.name ?? "Application detail"}
      description={
        application
          ? `Manage ${application.name}'s authorization boundary and connected clients.`
          : "Review the selected application's authorization settings."
      }
      eyebrow="Authorization / Application detail"
      title={application?.name ?? "Application detail"}
    >
      <div className="space-y-6">
        {applicationsQuery.isLoading ? <AdminStatus>Loading application...</AdminStatus> : null}
        {applicationsQuery.isError ? (
          <AdminError>{formatApiError(applicationsQuery.error)}</AdminError>
        ) : null}
        {!applicationsQuery.isLoading && !applicationsQuery.isError && !application ? (
          <div className="space-y-4">
            <AdminError>The application is no longer available.</AdminError>
            <LinkButton href="/admin/applications" variant="secondary">
              Back to applications
            </LinkButton>
          </div>
        ) : null}
        {application ? (
          <ApplicationDetailContext.Provider value={{ application, onDeleted, onRefresh: refresh }}>
            <section aria-labelledby="application-detail-title" className="space-y-6">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <LinkButton className="mb-4" href="/admin/applications" variant="ghost">
                    Back to applications
                  </LinkButton>
                  <p className="text-sm font-medium uppercase tracking-[0.16em] text-(--tangerine)">
                    Application detail
                  </p>
                  <h2
                    className="mt-2 font-display text-3xl font-semibold text-kumo-strong"
                    id="application-detail-title"
                  >
                    {application.name}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <StatusPill status={application.status} />
                  <Badge appearance="filled" variant="neutral">
                    authz version {application.authzVersion}
                  </Badge>
                </div>
              </div>
              <Tabs
                className="w-full"
                onValueChange={(value) => {
                  if (isApplicationTab(value)) void navigateToTab(value);
                }}
                tabs={applicationTabItems}
                value={activeTab}
                variant="underline"
              />
              {status ? <AdminStatus>{status}</AdminStatus> : null}
              {children}
            </section>
          </ApplicationDetailContext.Provider>
        ) : null}
      </div>
    </AdminLayout>
  );
}

export function useApplicationDetail() {
  const context = useContext(ApplicationDetailContext);
  if (!context) {
    throw new Error("Application detail tabs must render inside ApplicationDetailPage.");
  }
  return context;
}

function applicationTabFromPath(pathname: string): ApplicationTab {
  if (pathname.endsWith("/settings")) return "settings";
  if (pathname.endsWith("/roles")) return "roles";
  if (pathname.endsWith("/oidc")) return "oidc";
  if (pathname.endsWith("/access")) return "access";
  return "overview";
}

function isApplicationTab(value: string): value is ApplicationTab {
  return applicationTabItems.some((tab) => tab.value === value);
}

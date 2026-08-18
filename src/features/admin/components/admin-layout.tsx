import {
  Badge,
  Banner,
  Breadcrumbs,
  Button,
  Dialog,
  Link,
  LinkButton,
  Sidebar,
} from "@cloudflare/kumo";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactElement, type ReactNode } from "react";

import { authClient } from "~/features/auth/api/auth-client";
import { authQueryKeys, sessionQueryOptions } from "~/features/auth/api/queries";
import { adminAccessQueryOptions } from "~/features/admin/api/queries";
import { hasAdminPermission } from "~/features/admin/routing/policy";

const navigation = [
  { href: "/admin/users", label: "Users", icon: "users", permission: "users:read" },
  { href: "/admin/teams", label: "Teams", icon: "teams", permission: "teams:read" },
  {
    href: "/admin/applications",
    label: "Applications",
    icon: "applications",
    permission: "applications:read",
  },
  {
    href: "/admin/service-accounts",
    label: "Service accounts",
    icon: "service-accounts",
    permission: "service-accounts:read",
  },
  {
    href: "/admin/system-roles",
    label: "System roles",
    icon: "system-roles",
    permission: "system-roles:read",
  },
] as const;

type AdminIconName = (typeof navigation)[number]["icon"] | "sign-out";

export type AdminBreadcrumb = Readonly<{
  href?: string;
  label: string;
}>;

export function AdminLayout({
  activePath,
  breadcrumbItems,
  children,
  description,
  eyebrow,
  title,
}: Readonly<{
  activePath: (typeof navigation)[number]["href"];
  breadcrumbItems?: readonly AdminBreadcrumb[];
  children: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}>) {
  const queryClient = useQueryClient();
  const sessionQuery = useQuery(sessionQueryOptions);
  const accessQuery = useQuery(adminAccessQueryOptions);
  const visibleNavigation = navigation.filter((item) =>
    hasAdminPermission(accessQuery.data, item.permission),
  );
  const activeNavigationItem = navigation.find((item) => item.href === activePath);
  const resolvedBreadcrumbItems = breadcrumbItems ?? [
    { label: activeNavigationItem?.label ?? "Administration" },
  ];

  async function signOut() {
    await authClient.signOut();
    await queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
    if (typeof window !== "undefined") window.location.assign("/sign-in");
  }

  return (
    <div className="min-h-screen bg-kumo-canvas">
      <a
        className="sr-only focus:not-sr-only focus:fixed focus:inset-s-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-kumo-strong focus:px-4 focus:py-3 focus:text-base focus:text-kumo-canvas"
        href="#admin-content"
      >
        Skip to content
      </a>
      <Sidebar.Provider className="h-svh min-h-svh" collapsible="icon" defaultOpen>
        <Sidebar>
          <Sidebar.Header>
            <Sidebar.Menu className="min-w-0 flex-1">
              <Sidebar.MenuButton href="/" icon={<ShuiMark />} tooltip="Shui home">
                SHUI/
              </Sidebar.MenuButton>
            </Sidebar.Menu>
            <Sidebar.Trigger />
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Group>
              <Sidebar.GroupLabel>Administration</Sidebar.GroupLabel>
              <Sidebar.Menu aria-label="Administration">
                {visibleNavigation.map((item) => (
                  <Sidebar.MenuButton
                    active={item.href === activePath}
                    aria-current={item.href === activePath ? "page" : undefined}
                    href={item.href}
                    icon={<AdminIcon name={item.icon} />}
                    key={item.href}
                    tooltip={item.label}
                  >
                    {item.label}
                  </Sidebar.MenuButton>
                ))}
              </Sidebar.Menu>
            </Sidebar.Group>
          </Sidebar.Content>
          {sessionQuery.data?.user ? (
            <Sidebar.Footer className="h-auto min-h-12 flex-col items-stretch gap-2 py-3">
              <p className="truncate px-1 text-sm text-kumo-subtle group-data-[state=collapsed]/sidebar:hidden">
                {sessionQuery.data.user.name || sessionQuery.data.user.email}
              </p>
              <Sidebar.Menu className="w-full">
                <Sidebar.MenuButton
                  icon={<AdminIcon name="sign-out" />}
                  onClick={() => void signOut()}
                  tooltip="Sign out"
                >
                  Sign out
                </Sidebar.MenuButton>
              </Sidebar.Menu>
            </Sidebar.Footer>
          ) : null}
          <Sidebar.Rail />
        </Sidebar>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-kumo-canvas">
          <header className="flex items-center gap-3 border-b border-kumo-line bg-kumo-elevated px-4 py-3 md:hidden">
            <Sidebar.Trigger />
            <LinkButton className="m1-wordmark" href="/" variant="ghost">
              SHUI<span>/</span>
            </LinkButton>
          </header>
          <div className="flex min-h-14.5 items-center border-b border-kumo-line bg-kumo-elevated px-5 py-2 sm:px-8">
            <nav
              aria-label="breadcrumb"
              className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-0.5 text-sm"
            >
              <span className="flex shrink-0 items-center gap-0.5">
                <Breadcrumbs.Link href="/" icon={<ShuiMark />}>
                  SHUI
                </Breadcrumbs.Link>
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                <Breadcrumbs.Separator />
                <Link className="text-kumo-subtle no-underline" href="/admin" variant="plain">
                  Administration
                </Link>
              </span>
              {resolvedBreadcrumbItems.map((item, index) => {
                const isCurrent = index === resolvedBreadcrumbItems.length - 1;

                return (
                  <span
                    className="flex min-w-0 shrink-0 items-center gap-0.5"
                    key={`${index}-${item.href ?? "current"}-${item.label}`}
                  >
                    <Breadcrumbs.Separator />
                    {isCurrent ? (
                      <Breadcrumbs.Current>{item.label}</Breadcrumbs.Current>
                    ) : item.href ? (
                      <Link
                        className="text-kumo-subtle no-underline"
                        href={item.href}
                        variant="plain"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <Breadcrumbs.Current>{item.label}</Breadcrumbs.Current>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>
          <main
            aria-labelledby="admin-page-title"
            className="mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 sm:pt-10"
            id="admin-content"
          >
            <div className="max-w-3xl">
              <p className="text-base font-medium text-(--tangerine)">{eyebrow}</p>
              <h1
                className="mt-2 font-display text-3xl font-semibold leading-tight text-kumo-strong sm:text-4xl"
                id="admin-page-title"
              >
                {title}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-kumo-subtle">{description}</p>
            </div>
            <div className="mt-7">{children}</div>
          </main>
        </div>
      </Sidebar.Provider>
    </div>
  );
}

export function AdminError({ children }: Readonly<{ children: ReactNode }>) {
  return <Banner description={children} role="alert" size="sm" variant="error" />;
}

export function AdminStatus({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p aria-live="polite" className="text-base text-kumo-success" role="status">
      {children}
    </p>
  );
}

export function StatusPill({ status }: Readonly<{ status: string }>) {
  return (
    <Badge appearance="dot" variant={statusVariant(status)}>
      {status}
    </Badge>
  );
}

export function AdminConfirmDialog({
  confirmLabel = "Confirm",
  description,
  onConfirm,
  title,
  trigger,
}: Readonly<{
  confirmLabel?: string;
  description: string;
  onConfirm: () => void;
  title: string;
  trigger: ReactElement;
}>) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root onOpenChange={setOpen} open={open} role="alertdialog">
      <Dialog.Trigger render={trigger} />
      <Dialog className="p-6" size="sm">
        <Dialog.Title className="text-lg font-semibold text-kumo-strong">{title}</Dialog.Title>
        <Dialog.Description className="mt-2 text-base leading-6 text-kumo-subtle">
          {description}
        </Dialog.Description>
        <div className="mt-6 flex justify-end gap-3">
          <Dialog.Close
            render={(props) => (
              <Button {...props} type="button" variant="secondary">
                Cancel
              </Button>
            )}
          />
          <Button
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
            type="button"
            variant="destructive"
          >
            {confirmLabel}
          </Button>
        </div>
      </Dialog>
    </Dialog.Root>
  );
}

function statusVariant(status: string) {
  if (status === "active") return "success" as const;
  if (status === "disabled") return "warning" as const;
  return "neutral" as const;
}

function ShuiMark() {
  return (
    <span
      aria-hidden="true"
      className="grid size-4 shrink-0 place-items-center rounded-sm bg-(--tangerine) text-[10px] font-semibold text-kumo-canvas"
    >
      S
    </span>
  );
}

export function AdminIcon({ name }: Readonly<{ name: AdminIconName }>) {
  const paths = {
    "service-accounts": (
      <>
        <path d="M7.5 3.5h9v17h-9z" />
        <path d="M10.5 7.5h3M10.5 11.5h3M10.5 15.5h3" />
      </>
    ),
    applications: (
      <>
        <rect height="13" rx="2" width="16" x="4" y="5.5" />
        <path d="M8 5.5V4h8v1.5M8 10h8M8 14h5" />
      </>
    ),
    "sign-out": (
      <>
        <path d="M10 5H5.5v14H10" />
        <path d="m14 8 4 4-4 4M18 12H9" />
      </>
    ),
    "system-roles": (
      <>
        <path d="m12 3 7 3v5c0 4.2-2.9 7.8-7 9-4.1-1.2-7-4.8-7-9V6z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    teams: (
      <>
        <circle cx="9" cy="9" r="3" />
        <circle cx="16" cy="10" r="2.5" />
        <path d="M3.5 19c.5-2.8 2.4-4 5.5-4s5 1.2 5.5 4M14 15.5c2.8-.2 4.6.9 5 3.5" />
      </>
    ),
    users: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path d="M5 20c.6-3.5 2.9-5 7-5s6.4 1.5 7 5" />
      </>
    ),
  } as const;

  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.75"
      viewBox="0 0 24 24"
    >
      {paths[name]}
    </svg>
  );
}

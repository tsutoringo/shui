import { Link as KumoLink, LinkProvider } from "@cloudflare/kumo";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Link as RouterLink, Outlet } from "@tanstack/react-router";

import { AppLink } from "../components/app-link";
import { RootDocument } from "../components/root-document";
import "../styles/app.css";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "description", content: "Shui identity control plane" },
    ],
    title: "Shui | identity control plane",
  }),
  component: RootComponent,
});

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <RootDocument>
      <QueryClientProvider client={queryClient}>
        <LinkProvider component={AppLink}>
          <div className="min-h-screen bg-kumo-canvas text-kumo-default">
            <header className="border-b border-kumo-line">
              <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
                <RouterLink className="inline-flex items-center gap-3" to="/">
                  <span className="grid size-9 place-items-center rounded-lg bg-(--tangerine) font-semibold text-(--ink)">
                    S
                  </span>
                  <span className="font-display text-lg font-semibold">shui</span>
                </RouterLink>
                <nav className="flex items-center gap-1 text-sm">
                  <KumoLink
                    className="rounded-md px-3 py-2 text-sm transition-none"
                    href="/consent"
                    variant="plain"
                  >
                    Consent
                  </KumoLink>
                  <KumoLink
                    className="rounded-md px-3 py-2 text-sm transition-none"
                    href="/sign-in"
                    variant="plain"
                  >
                    Sign in
                  </KumoLink>
                </nav>
              </div>
            </header>
            <main>
              <Outlet />
            </main>
          </div>
        </LinkProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

import { LinkProvider } from "@cloudflare/kumo";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet, redirect } from "@tanstack/react-router";

import { AppLink } from "../components/shared/app-link";
import { RootDocument } from "../components/shared/root-document";
import { getSetupRedirect } from "../lib/setup-routing";
import { getApiFetch } from "./api.$";
import "../styles/app.css";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: async ({ location }) => {
    const response = await getApiFetch()("/api/setup/status", {
      body: {},
      headers: {},
      method: "GET",
    }).catch(() => null);
    if (!response) return;

    const redirectTo = getSetupRedirect(
      location.pathname,
      response.status,
      response.data?.available === true,
    );
    if (redirectTo) throw redirect({ to: redirectTo });
  },
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
            <main>
              <Outlet />
            </main>
          </div>
        </LinkProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

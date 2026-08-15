import { LinkProvider } from "@cloudflare/kumo";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";

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
            <main>
              <Outlet />
            </main>
          </div>
        </LinkProvider>
      </QueryClientProvider>
    </RootDocument>
  );
}

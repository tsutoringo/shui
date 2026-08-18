import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";
import { parseRouterSearch, stringifyRouterSearch } from "./shared/routing/search-params";

export function getRouter() {
  return createRouter({
    context: { queryClient: new QueryClient() },
    defaultPreload: "intent",
    parseSearch: parseRouterSearch,
    routeTree,
    scrollRestoration: true,
    stringifySearch: stringifyRouterSearch,
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: Awaited<ReturnType<typeof getRouter>>;
  }
}

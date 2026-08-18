import { createFileRoute } from "@tanstack/react-router";

import { ConsentPage } from "~/features/consent";

export const Route = createFileRoute("/consent")({
  validateSearch: (search) => ({
    claims: typeof search.claims === "string" ? search.claims : undefined,
    client_id: typeof search.client_id === "string" ? search.client_id : undefined,
    scope: typeof search.scope === "string" ? search.scope : undefined,
  }),
  component: ConsentRoute,
});

function ConsentRoute() {
  const { claims, client_id: clientId, scope } = Route.useSearch();
  return <ConsentPage claimsQuery={claims} clientId={clientId} scope={scope} />;
}

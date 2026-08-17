import { createFileRoute } from "@tanstack/react-router";

import { ForbiddenPage } from "~/features/access-denied";

export const Route = createFileRoute("/forbidden")({
  validateSearch: (search) => ({
    from: typeof search.from === "string" ? search.from : undefined,
  }),
  component: ForbiddenPage,
});

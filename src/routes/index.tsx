import { Badge, LayerCard, LinkButton } from "@cloudflare/kumo";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { healthQueryOptions } from "../lib/health-query";

export const Route = createFileRoute("/")({
  component: HomePage,
  loader: async ({ context }) => {
    try {
      const health = await context.queryClient.ensureQueryData(healthQueryOptions);
      return { apiStatus: health.status };
    } catch {
      return { apiStatus: "unavailable" as const };
    }
  },
});

function HomePage() {
  const { apiStatus } = Route.useLoaderData();
  const health = useQuery(healthQueryOptions);
  const status = health.data?.status ?? apiStatus;

  return (
    <section className="mx-auto grid max-w-6xl gap-12 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
      <div>
        <Badge className="text-sm" variant="orange">
          M0 / compatibility spike
        </Badge>
        <h1 className="mt-4 max-w-3xl font-display text-5xl font-semibold leading-[0.98] text-kumo-strong sm:text-7xl">
          One calm place for every identity.
        </h1>
        <p className="mt-4 max-w-xl text-sm leading-6 text-kumo-subtle">
          Shui is an identity control plane for people, applications, permissions, and the protocols
          that connect them.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LinkButton
            className="w-full text-sm transition-none sm:w-auto"
            href="/sign-in"
            size="lg"
            variant="primary"
          >
            Open the control plane
          </LinkButton>
          <LinkButton
            className="w-full text-sm transition-none sm:w-auto"
            href="/api/health"
            size="lg"
            variant="outline"
          >
            Inspect API health
          </LinkButton>
        </div>
      </div>
      <LayerCard className="bg-kumo-elevated px-5 py-4 ring ring-kumo-line">
        <p className="text-sm font-medium uppercase text-kumo-subtle">Runtime signal</p>
        <h2 className="mt-2 font-display text-3xl font-semibold text-kumo-strong">
          The edge is awake.
        </h2>
        <div className="mt-5 flex items-center justify-between rounded-lg border border-kumo-hairline bg-kumo-recessed p-4">
          <span className="text-sm text-kumo-subtle">Elysia /api/health</span>
          <Badge
            appearance="dot"
            className="text-sm"
            variant={status === "ok" ? "success" : "warning"}
          >
            {status}
          </Badge>
        </div>
        <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-kumo-subtle">Runtime</dt>
            <dd className="mt-1 text-kumo-default">Workers</dd>
          </div>
          <div>
            <dt className="text-kumo-subtle">Database</dt>
            <dd className="mt-1 text-kumo-default">D1 + Drizzle</dd>
          </div>
        </dl>
      </LayerCard>
    </section>
  );
}

import { Button, LayerCard, LinkButton } from "@cloudflare/kumo";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/consent")({ component: ConsentPage });

function ConsentPage() {
  return (
    <section className="mx-auto max-w-2xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm font-medium uppercase text-(--tangerine)">Authorization</p>
      <h1 className="mt-4 font-display text-5xl font-semibold leading-none text-kumo-strong">
        Give access with confidence.
      </h1>
      <LayerCard className="mt-10 bg-kumo-elevated px-5 py-4 ring ring-kumo-line">
        <h2 className="text-2xl font-semibold text-kumo-strong">Mikan compatibility client</h2>
        <p className="mt-2 text-sm text-kumo-subtle">
          The requesting app and exact scopes will be filled from the OAuth request.
        </p>
        <ul className="mt-6 space-y-3 text-sm text-kumo-default">
          <li className="rounded-lg border border-kumo-hairline bg-kumo-recessed p-3">openid</li>
          <li className="rounded-lg border border-kumo-hairline bg-kumo-recessed p-3">profile</li>
          <li className="rounded-lg border border-kumo-hairline bg-kumo-recessed p-3">email</li>
        </ul>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button className="text-sm transition-none" type="button" variant="primary">
            Allow access
          </Button>
          <LinkButton className="w-full text-sm transition-none sm:w-auto" href="/" variant="ghost">
            Cancel
          </LinkButton>
        </div>
      </LayerCard>
    </section>
  );
}

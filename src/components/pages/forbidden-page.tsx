import { LayerCard, LinkButton } from "@cloudflare/kumo";

export function ForbiddenPage() {
  return (
    <section className="mx-auto max-w-xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm font-medium text-(--tangerine)">Access control</p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-none text-kumo-strong sm:text-6xl">
        You do not have access.
      </h1>
      <LayerCard className="mt-10 bg-kumo-elevated p-5 ring ring-kumo-line sm:p-6">
        <p className="text-sm leading-6 text-kumo-subtle">
          Your account is signed in, but its system role does not allow this administration area.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <LinkButton className="justify-center text-sm" href="/" variant="primary">
            Return home
          </LinkButton>
          <LinkButton className="justify-center text-sm" href="/sign-in" variant="ghost">
            Sign in as another user
          </LinkButton>
        </div>
      </LayerCard>
    </section>
  );
}

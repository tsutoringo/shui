import { LinkButton } from "@cloudflare/kumo";

export function LandingPage() {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-kumo-canvas">
      <div aria-hidden="true" className="m1-orbit m1-orbit-one" />
      <div aria-hidden="true" className="m1-orbit m1-orbit-two" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <LinkButton className="m1-wordmark" href="/" variant="ghost">
          SHUI<span>/</span>
        </LinkButton>
        <div className="flex items-center gap-2">
          <LinkButton className="text-sm" href="/users" variant="ghost">
            Admin console
          </LinkButton>
          <LinkButton className="text-sm" href="/sign-in" variant="ghost">
            Sign in
          </LinkButton>
        </div>
      </header>
      <main className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-20 sm:px-8 lg:grid-cols-[1fr_0.75fr] lg:items-end lg:pt-32">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-(--tangerine)">
            Identity control plane
          </p>
          <h1 className="mt-5 max-w-3xl font-display text-5xl font-semibold leading-[0.92] text-kumo-strong sm:text-7xl">
            Access starts with a clear identity.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-kumo-subtle">
            Shui gives people and applications one deliberate place to authenticate, request access,
            and carry the right context downstream.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <LinkButton className="justify-center text-sm" href="/sign-in" variant="primary">
              Sign in to Shui
            </LinkButton>
            <LinkButton className="justify-center text-sm" href="/invite" variant="ghost">
              Invite a teammate
            </LinkButton>
            <LinkButton className="justify-center text-sm" href="/setup" variant="ghost">
              First-run setup
            </LinkButton>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {[
            ["01", "Closed by default", "No public account creation after bootstrap."],
            ["02", "Invite with intent", "Every seat has an expiry and a single use."],
            ["03", "Revoke cleanly", "Disabled identities lose their sessions."],
          ].map(([number, title, description]) => (
            <div className="border-t border-kumo-line py-4" key={number}>
              <p className="text-xs font-medium tracking-[0.18em] text-(--tangerine)">{number}</p>
              <h2 className="mt-2 text-lg font-semibold text-kumo-strong">{title}</h2>
              <p className="mt-1 text-sm leading-6 text-kumo-subtle">{description}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

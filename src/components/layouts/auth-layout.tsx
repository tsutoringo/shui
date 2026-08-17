import { LinkButton, LayerCard } from "@cloudflare/kumo";
import type { ReactNode } from "react";

export function AuthLayout({
  eyebrow,
  title,
  description,
  children,
  footer,
}: Readonly<{
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}>) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-kumo-canvas">
      <div aria-hidden="true" className="m1-orbit m1-orbit-one" />
      <div aria-hidden="true" className="m1-orbit m1-orbit-two" />
      <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <LinkButton className="m1-wordmark" href="/" variant="ghost">
          SHUI<span>/</span>
        </LinkButton>
        <p className="hidden text-xs font-medium uppercase tracking-[0.22em] text-kumo-subtle sm:block">
          Identity control plane
        </p>
      </header>
      <main className="relative mx-auto grid w-full max-w-6xl gap-10 px-5 pb-16 pt-8 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,0.8fr)_minmax(22rem,1fr)] lg:items-start lg:gap-20 lg:pt-24">
        <div className="max-w-xl">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-(--tangerine)">
            {eyebrow}
          </p>
          <h1 className="mt-5 max-w-lg font-display text-4xl font-semibold leading-[0.98] text-kumo-strong sm:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-md text-base leading-7 text-kumo-subtle">{description}</p>
          <div className="mt-10 hidden border-l border-(--tangerine)/40 pl-5 text-sm leading-6 text-kumo-subtle lg:block">
            One place for people, applications, and access decisions.
          </div>
        </div>
        <LayerCard className="m1-panel bg-kumo-elevated p-5 ring ring-kumo-line sm:p-7">
          {children}
          {footer ? <div className="mt-7 border-t border-kumo-hairline pt-5">{footer}</div> : null}
        </LayerCard>
      </main>
    </div>
  );
}

export function FormError({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="text-sm text-(--m1-error)" role="alert">
      {children}
    </p>
  );
}

export function FormStatus({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <p className="text-sm text-kumo-brand" role="status">
      {children}
    </p>
  );
}

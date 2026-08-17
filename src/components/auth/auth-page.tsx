import { Button, Input, LayerCard, LinkButton } from "@cloudflare/kumo";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { authClient } from "../../lib/auth-client";
import { authQueryKeys } from "../../lib/auth-queries";

export function AuthPage({ redirectTo = "/" }: Readonly<{ redirectTo?: string }>) {
  const queryClient = useQueryClient();
  const signIn = useMutation({
    mutationFn: async (value: { email: string; password: string }) => {
      const { data, error } = await authClient.signIn.email(value);

      if (error) {
        throw error;
      }

      return data;
    },
    mutationKey: ["auth", "sign-in"],
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: authQueryKeys.session });
      if (data?.redirect) return;
      if (typeof window !== "undefined") window.location.assign(redirectTo);
    },
    retry: false,
  });
  const form = useForm({
    defaultValues: { email: "", password: "" },
    onSubmit: ({ value }) => {
      signIn.mutate(value);
    },
  });
  const message = signIn.isError
    ? "The credentials could not be verified."
    : signIn.isSuccess
      ? "Signed in."
      : undefined;

  return (
    <section className="mx-auto max-w-xl px-5 py-14 sm:px-8 sm:py-20">
      <p className="text-sm font-medium uppercase text-(--tangerine)">Welcome back</p>
      <h1 className="mt-4 font-display text-2xl font-semibold leading-none text-kumo-strong">
        shui にログインする
      </h1>
      <LayerCard className="mt-10 bg-kumo-elevated px-5 py-4 ring ring-kumo-line">
        <h2 className="text-2xl font-semibold text-kumo-strong">サインイン</h2>
        <p className="mt-2 text-sm text-kumo-subtle">
          M0 uses Better Auth email/password as its first protocol probe.
        </p>
        <form
          className="mt-6 space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            void form.handleSubmit();
          }}
        >
          <form.Field name="email">
            {(field) => (
              <Input
                id="email"
                autoComplete="email"
                className="text-sm transition-none"
                label="メールアドレス"
                onChange={(event) => field.handleChange(event.target.value)}
                value={field.state.value}
              />
            )}
          </form.Field>
          <form.Field name="password">
            {(field) => (
              <Input
                id="password"
                autoComplete="current-password"
                className="text-sm transition-none"
                label="パスワード"
                onChange={(event) => field.handleChange(event.target.value)}
                type="password"
                value={field.state.value}
              />
            )}
          </form.Field>
          <Button
            aria-busy={signIn.isPending}
            className="w-full justify-center text-sm transition-none"
            disabled={signIn.isPending}
            type="submit"
            variant="primary"
          >
            {signIn.isPending ? "Signing in..." : "Continue"}
          </Button>
          {message ? (
            <p className="text-sm text-kumo-brand" role={signIn.isError ? "alert" : "status"}>
              {message}
            </p>
          ) : null}
          <p className="text-sm text-kumo-subtle">
            <LinkButton href="/forgot-password" variant="ghost">
              Forgot your password?
            </LinkButton>
          </p>
        </form>
      </LayerCard>
    </section>
  );
}

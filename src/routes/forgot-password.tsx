import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordPage } from "~/features/password-recovery";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

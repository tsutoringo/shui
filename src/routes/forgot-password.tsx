import { createFileRoute } from "@tanstack/react-router";

import { ForgotPasswordPage } from "../components/auth/password-recovery-page";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

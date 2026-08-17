import { createFileRoute } from "@tanstack/react-router";

import { ServiceAccountsAdminPage } from "../components/service-accounts-admin-page";

export const Route = createFileRoute("/service-accounts")({ component: ServiceAccountsAdminPage });

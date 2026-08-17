import { createFileRoute } from "@tanstack/react-router";

import { UsersAdminPage } from "../components/users-admin-page";

export const Route = createFileRoute("/users")({ component: UsersAdminPage });

import { createFileRoute } from "@tanstack/react-router";

import { SystemRolesAdminPage } from "../components/system-roles-admin-page";

export const Route = createFileRoute("/system-roles")({ component: SystemRolesAdminPage });

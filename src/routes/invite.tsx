import { createFileRoute } from "@tanstack/react-router";

import { InviteAdminPage } from "../components/invite-admin-page";

export const Route = createFileRoute("/invite")({ component: InviteAdminPage });

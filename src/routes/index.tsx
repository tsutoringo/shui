import { createFileRoute } from "@tanstack/react-router";

import { LandingPage } from "../components/pages/landing-page";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

import { eq } from "drizzle-orm";

import { user } from "../../db/auth-schema";
import { type AppDb } from "../../db";
import { teams } from "../../db/domain-schema";
import { ApiError } from "./errors";
import { resolveHumanPrincipal } from "./users/service";

export type OwnershipInput = {
  ownerId: string;
  ownerType: "user" | "team";
};

export type ResolvedOwnership = {
  ownerUserPrincipalId: string | null;
  ownerTeamId: string | null;
  owner: {
    id: string;
    label: string;
    type: "user" | "team";
  };
};

export async function resolveActiveOwner(database: AppDb, input: OwnershipInput) {
  if (input.ownerType === "user") {
    const human = await resolveHumanPrincipal(database, input.ownerId);
    if (!human || human.principal_status !== "active" || human.human_status !== "active") {
      throw new ApiError(409);
    }

    const managedUser = await database
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, human.user_id))
      .get();
    if (!managedUser) throw new ApiError(409);

    return {
      ownerUserPrincipalId: human.principal_id,
      ownerTeamId: null,
      owner: {
        id: human.principal_id,
        label: managedUser.name || managedUser.email,
        type: "user" as const,
      },
    } satisfies ResolvedOwnership;
  }

  const team = await database
    .select({ id: teams.id, name: teams.name, status: teams.status })
    .from(teams)
    .where(eq(teams.id, input.ownerId))
    .get();
  if (!team || team.status !== "active") throw new ApiError(409);

  return {
    ownerUserPrincipalId: null,
    ownerTeamId: team.id,
    owner: { id: team.id, label: team.name, type: "team" as const },
  } satisfies ResolvedOwnership;
}

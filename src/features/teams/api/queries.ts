import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeams,
  removeTeamMember,
  setTeamStatus,
  updateTeam,
} from "~/features/teams/api/client";
import { userQueryKeys } from "~/features/users/api/queries";
import type { TeamUpdateBody } from "~/server/modules/teams/models";

export const teamQueryKeys = {
  all: ["teams"] as const,
};

export const teamsQueryOptions = queryOptions({
  queryFn: getTeams,
  queryKey: teamQueryKeys.all,
  retry: false,
});

export const createTeamMutationOptions = () => mutationOptions({ mutationFn: createTeam });

export const updateTeamMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, body }: { body: TeamUpdateBody; id: string }) => updateTeam(id, body),
  });

export const setTeamStatusMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ id, status }: { id: string; status: "active" | "disabled" }) =>
      setTeamStatus(id, status),
  });

export const deleteTeamMutationOptions = () => mutationOptions({ mutationFn: deleteTeam });

export const addTeamMemberMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ teamId, body }: { body: Parameters<typeof addTeamMember>[1]; teamId: string }) =>
      addTeamMember(teamId, body),
  });

export const removeTeamMemberMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      removeTeamMember(teamId, userId),
  });

export { userQueryKeys };

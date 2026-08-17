import { mutationOptions, queryOptions } from "@tanstack/react-query";

import {
  acceptInvitation,
  createInvitation,
  getInvitation,
} from "~/features/invitations/api/client";
import type { InvitationAcceptBody } from "~/server/modules/models";

export const invitationQueryKeys = {
  invitation: (token: string) => ["invitations", token] as const,
};

export const invitationQueryOptions = (token: string) =>
  queryOptions({
    queryFn: () => getInvitation(token),
    queryKey: invitationQueryKeys.invitation(token),
    retry: false,
  });

export const createInvitationMutationOptions = () =>
  mutationOptions({ mutationFn: createInvitation });

export const acceptInvitationMutationOptions = () =>
  mutationOptions({
    mutationFn: ({ token, body }: { body: InvitationAcceptBody; token: string }) =>
      acceptInvitation(token, body),
  });

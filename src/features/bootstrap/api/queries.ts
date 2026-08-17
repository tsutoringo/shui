import { mutationOptions } from "@tanstack/react-query";

import { completeBootstrap, reserveBootstrap } from "~/features/bootstrap/api/client";

export const reserveBootstrapMutationOptions = () =>
  mutationOptions({ mutationFn: reserveBootstrap });

export const completeBootstrapMutationOptions = () =>
  mutationOptions({ mutationFn: completeBootstrap });

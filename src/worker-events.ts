import { expireStaleInvitations } from "./server/modules/invitations/service";

export function handleQueue(batch: MessageBatch<unknown>) {
  for (const message of batch.messages) message.ack();
}

export async function handleScheduled(
  controller: ScheduledController,
  environment?: Pick<Env, "DB">,
) {
  if (environment) await expireStaleInvitations(environment.DB);
  console.info(JSON.stringify({ cron: controller.cron, message: "shui scheduled probe" }));
}

export function handleQueue(batch: MessageBatch<unknown>) {
  for (const message of batch.messages) message.ack();
}

export function handleScheduled(controller: ScheduledController) {
  console.info(JSON.stringify({ cron: controller.cron, message: "shui scheduled probe" }));
}

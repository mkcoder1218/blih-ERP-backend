import { JobDefinition } from "../runner";
import { SubscriptionService } from "../../modules/subscription/subscription.service";

export const subscriptionExpiryCheck: JobDefinition = {
  name: "SubscriptionExpiryCheck",
  type: "billing",
  cronExpression: "0 * * * *", // Hourly: trials, renewals, grace and retention transitions.
  handler: async () => {
    const service = new SubscriptionService();
    await service.processLifecycle(new Date());
  },
};

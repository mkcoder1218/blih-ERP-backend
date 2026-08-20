import { db } from "../src/models";
import { SubscriptionService, type EffectiveSubscriptionPolicy } from "../src/modules/subscription/subscription.service";

const policy: EffectiveSubscriptionPolicy = {
  gracePeriodDays: 7,
  graceAccessMode: "read_only",
  expiredAccessMode: "billing_only",
  retentionDays: 90,
  downgradePolicy: "block",
  autoRenew: false,
  metadata: {},
};

describe("Subscription lifecycle and access policy", () => {
  afterEach(() => jest.restoreAllMocks());

  it("uses the administrator-defined yearly price instead of multiplying monthly when present", () => {
    const service = new SubscriptionService();
    expect(service.priceForCycle({ priceMonthly: 3000, priceYearly: 30000, basePrice: 3000 }, "yearly")).toBe(30000);
    expect(service.priceForCycle({ priceMonthly: 3000, priceYearly: 0, basePrice: 3000 }, "yearly")).toBe(36000);
    expect(service.priceForCycle({ priceMonthly: 3000, priceYearly: 30000, basePrice: 3000 }, "monthly")).toBe(3000);
  });

  it("preserves full access for legacy businesses that have not been assigned a subscription yet", async () => {
    jest.spyOn(db.Subscription, "findOne").mockResolvedValue(null as any);
    const service = new SubscriptionService();
    await expect(service.evaluateAccess("business-1", "POST", ["BUSINESS_ADMIN"])).resolves.toMatchObject({
      allowed: true,
      mode: "full",
      status: "legacy_unassigned",
    });
  });

  it("allows all ERP operations for an active subscription", async () => {
    jest.spyOn(db.Subscription, "findOne").mockResolvedValue({ status: "active", planId: "plan-1" } as any);
    const service = new SubscriptionService();
    jest.spyOn(service, "resolvePolicy").mockResolvedValue(policy);
    await expect(service.evaluateAccess("business-1", "POST", ["EMPLOYEE"])).resolves.toMatchObject({ allowed: true, mode: "full" });
  });

  it("keeps a newly-created paid plan billing-only until manual payment is confirmed", async () => {
    jest.spyOn(db.Subscription, "findOne").mockResolvedValue({ status: "pending_payment", planId: "plan-1" } as any);
    const service = new SubscriptionService();
    jest.spyOn(service, "resolvePolicy").mockResolvedValue(policy);
    const result = await service.evaluateAccess("business-1", "GET", ["BUSINESS_ADMIN"]);
    expect(result.allowed).toBe(false);
    expect(result.mode).toBe("billing_only");
  });

  it("honors read-only grace access while an invoice is past due", async () => {
    jest.spyOn(db.Subscription, "findOne").mockResolvedValue({
      status: "past_due",
      planId: "plan-1",
      pastDueSince: new Date(),
      currentPeriodEnd: new Date(),
    } as any);
    const service = new SubscriptionService();
    jest.spyOn(service, "resolvePolicy").mockResolvedValue(policy);

    const read = await service.evaluateAccess("business-1", "GET", ["EMPLOYEE"]);
    const write = await service.evaluateAccess("business-1", "POST", ["EMPLOYEE"]);
    expect(read).toMatchObject({ allowed: true, mode: "read_only" });
    expect(write).toMatchObject({ allowed: false, mode: "read_only" });
  });

  it("supports per-business business-admin-only access after expiry", async () => {
    jest.spyOn(db.Subscription, "findOne").mockResolvedValue({ status: "expired", planId: "plan-1" } as any);
    const service = new SubscriptionService();
    jest.spyOn(service, "resolvePolicy").mockResolvedValue({ ...policy, expiredAccessMode: "business_admin_only" });

    await expect(service.evaluateAccess("business-1", "POST", ["BUSINESS_ADMIN"])).resolves.toMatchObject({ allowed: true, mode: "business_admin_only" });
    await expect(service.evaluateAccess("business-1", "GET", ["EMPLOYEE"])).resolves.toMatchObject({ allowed: false, mode: "business_admin_only" });
  });

  it("hard-locks suspended subscriptions", async () => {
    jest.spyOn(db.Subscription, "findOne").mockResolvedValue({ status: "suspended", planId: "plan-1" } as any);
    const service = new SubscriptionService();
    jest.spyOn(service, "resolvePolicy").mockResolvedValue(policy);
    await expect(service.evaluateAccess("business-1", "GET", ["BUSINESS_ADMIN"])).resolves.toMatchObject({ allowed: false, mode: "locked" });
  });
});

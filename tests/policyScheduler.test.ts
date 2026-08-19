import { PolicyScheduler } from "../src/modules/policy/policy.scheduler";
import { shouldRegisterPolicyJobs } from "../src/modules/policy/policy.job-registration";

describe("Policy Scheduler & Job Registration Tests", () => {
  let scheduler: PolicyScheduler;

  beforeEach(() => {
    scheduler = new PolicyScheduler();
  });

  describe("Flag Combinations Evaluation", () => {
    it("returns true only when both JOB_WORKER_ENABLED and POLICY_JOBS_ENABLED are true", () => {
      expect(shouldRegisterPolicyJobs(true, true)).toBe(true);
      expect(shouldRegisterPolicyJobs(true, false)).toBe(false);
      expect(shouldRegisterPolicyJobs(false, true)).toBe(false);
      expect(shouldRegisterPolicyJobs(false, false)).toBe(false);
    });
  });

  describe("Scheduler Instance Methods", () => {
    it("instantiates PolicyScheduler correctly", () => {
      expect(scheduler).toBeDefined();
      expect(typeof scheduler.processScheduledPolicies).toBe("function");
      expect(typeof scheduler.processOverdueAcceptances).toBe("function");
      expect(typeof scheduler.processPolicyReminders).toBe("function");
    });
  });
});

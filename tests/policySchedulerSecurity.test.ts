import { PolicyScheduler } from "../src/modules/policy/policy.scheduler";

describe("Policy Scheduler Advisory Lock & Security Tests", () => {
  describe("Advisory Lock Key Hashing", () => {
    it("hashes string key to numeric string deterministically", () => {
      const hash1 = PolicyScheduler.hashKeyToBigInt("policy-job:policy.publish-scheduled");
      const hash2 = PolicyScheduler.hashKeyToBigInt("policy-job:policy.publish-scheduled");
      const hash3 = PolicyScheduler.hashKeyToBigInt("policy-job:policy.mark-overdue");

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
      expect(/^\d+$/.test(hash1)).toBe(true);
    });

    it("generates distinct hashes for different job keys", () => {
      const h1 = PolicyScheduler.hashKeyToBigInt("policy-job:policy.publish-scheduled");
      const h2 = PolicyScheduler.hashKeyToBigInt("policy-job:policy.send-reminders");
      expect(h1).not.toBe(h2);
    });
  });
});

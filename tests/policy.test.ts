import request from "supertest";
import express from "express";
import { computePolicyContentHash } from "../src/modules/policy/policy.sanitizer";

jest.mock("../src/middlewares/auth", () => ({
  authRequired: (req: any, _res: any, next: any) => next()
}));

jest.mock("../src/middlewares/module", () => ({
  requireActiveModule: () => (_req: any, _res: any, next: any) => next()
}));

import { policyRoutes } from "../src/modules/policy/policy.routes";
import { policyPublicRoutes } from "../src/modules/policy/policy.public.routes";

const app = express();
app.use(express.json());

let mockUser: any = null;

app.use((req, res, next) => {
  if (mockUser) req.user = mockUser;
  next();
});

app.use("/api/v1/policies", policyRoutes);
app.use("/api/v1/public", policyPublicRoutes);

describe("Policy Module Foundation Tests", () => {
  const bizA = "00000000-0000-0000-0000-0000000000a1";
  const userA = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    mockUser = null;
  });

  describe("Canonical SHA-256 Hashing Utility", () => {
    it("computes deterministic SHA-256 content hash", () => {
      const hash1 = computePolicyContentHash({
        policyId: "pol-100",
        version: 1,
        title: "Code of Conduct",
        contentHtml: "<h1>Conduct</h1><script>alert(1)</script>",
        requiresAcceptance: true,
        requiresSignature: false
      });

      const hash2 = computePolicyContentHash({
        policyId: "pol-100",
        version: 1,
        title: "Code of Conduct",
        contentHtml: "<h1>Conduct</h1>",
        requiresAcceptance: true,
        requiresSignature: false
      });

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });
  });

  describe("Permissions & Route Guards", () => {
    it("denies access if policy.access permission is missing", async () => {
      mockUser = { id: userA, businessId: bizA, permissions: [] };
      const res = await request(app)
        .get("/api/v1/policies/categories")
        .set("Authorization", "Bearer test-token");
      expect(res.status).toBe(403);
    });

    it("allows platform super admin even without explicit policy permissions", async () => {
      mockUser = { id: userA, businessId: bizA, isPlatformSuperAdmin: true, permissions: [] };
      const res = await request(app)
        .get("/api/v1/policies/categories")
        .set("Authorization", "Bearer test-token");
      expect(res.status).not.toBe(403);
    });
  });
});

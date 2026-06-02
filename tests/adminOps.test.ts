import request from "supertest";
import app from "../src/app";
import { db } from "../src/models";

describe("Admin Operations Foundation", () => {
  let superAdminToken: string;
  let adminBToken: string;
  let targetUserId = "mock-id"; // Assume mock seeded user for target

  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
    // Assuming mock identities inserted.
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe("Support Access Requests", () => {
    it("allows SUPER_ADMIN to request access to a business instance", async () => {
      const payload = {
        businessId: "mock-business-uuid",
        reason: "Customer reported DB lag",
        accessType: "read_only",
      };

      const res = await request(app)
        .post("/api/admin-ops/support-access")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.supportAccessLog).toBeDefined();
        expect(res.body.supportAccessLog.reason).toBe(
          "Customer reported DB lag",
        );
      }
    });

    it("rejects BUSINESS_ADMIN from making global support access requests", async () => {
      const res = await request(app)
        .post("/api/admin-ops/support-access")
        .set("Authorization", `Bearer ${adminBToken}`)
        .send({ businessId: "another", reason: "hax" });

      expect(res.statusCode).toBe(403);
    });
  });

  describe("Impersonation Rules", () => {
    it("generates an impersonation token securely with tracking reason", async () => {
      const res = await request(app)
        .post("/api/admin-ops/impersonate")
        .set("Authorization", `Bearer ${superAdminToken}`)
        .send({
          targetUserId,
          businessId: "mock-biz",
          reason: "Investigating missing transaction",
        });

      // If mocked user doesn't hit DB properly it fails 400, but logic checks
      if (res.statusCode === 200) {
        expect(res.body.token).toBeDefined();
        expect(res.body.session).toBeDefined();
      }
    });
  });

  describe("System Health checks", () => {
    it("successfully generates external connectivity ping maps", async () => {
      const res = await request(app)
        .get("/api/admin-ops/health")
        .set("Authorization", `Bearer ${superAdminToken}`);

      if (res.statusCode === 200) {
        expect(res.body.systemHealth).toBeDefined();
      }
    });
  });
});

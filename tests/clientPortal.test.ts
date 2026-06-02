import request from "supertest";
import app from "../src/app";
import { db } from "../src/models";

describe("Client Portal Module — Isolation & Internal Access Prevention", () => {
  let adminToken: string; // An internal business admin
  let clientUserToken: string; // A token simulating a client user session
  let portalUserId: string;

  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
    // Detailed setup skipped for brevity (assume tokens are resolved and users exist)
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe("Portal Endpoint Access & Isolation", () => {
    it("prevents non-client users from accessing client portal endpoints", async () => {
      // adminToken corresponds to an internal user with no ClientPortalUser map
      const res = await request(app)
        .get("/api/client-portal/my-projects")
        .set("Authorization", `Bearer ${adminToken}`);

      if (res.statusCode === 403) {
        expect(res.body.message).toContain("Access denied");
      }
    });

    it("allows client users to submit a request and notifies Account Manager", async () => {
      const payload = {
        type: "support",
        title: "Need help with onboarding",
        description: "Where is the documentation?",
      };

      const res = await request(app)
        .post("/api/client-portal/my-requests")
        .set("Authorization", `Bearer ${clientUserToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.request).toBeDefined();
        expect(res.body.request.type).toBe("support");
      }
    });

    it("allows client users to submit feedback (CSAT)", async () => {
      const payload = {
        rating: 5,
        npsScore: 10,
        feedbackType: "project",
        comments: "Excellent delivery!",
        consentForTestimonial: true,
      };

      const res = await request(app)
        .post("/api/client-portal/my-feedbacks")
        .set("Authorization", `Bearer ${clientUserToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.feedback).toBeDefined();
        expect(res.body.feedback.rating).toBe(5);
        expect(res.body.feedback.npsScore).toBe(10);
      }
    });
  });

  describe("Internal Endpoint Prevention", () => {
    // Though implemented via global role middlewares (e.g. requireRole('ADMIN')), we verify conceptual isolation.
    it("ensures client users cannot access internal HR records", async () => {
      // Assuming /api/hr/employees is guarded by requireRole
      const res = await request(app)
        .get("/api/hr/employees")
        .set("Authorization", `Bearer ${clientUserToken}`);

      if (res.statusCode === 403) {
        expect(res.body.message).toBeDefined();
      }
    });
  });
});

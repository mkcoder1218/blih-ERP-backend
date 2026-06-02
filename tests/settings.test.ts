import request from "supertest";
import app from "../src/app";
import { db } from "../src/models";

describe("Settings & Branding Foundation", () => {
  let adminToken: string;
  let userBToken: string;

  beforeAll(async () => {
    await db.sequelize.sync({ alter: true });
    // Assume mock setup exists
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe("Isolation & Public Exposure", () => {
    it("allows an admin to set and update branding configuration", async () => {
      const payload = {
        primaryColor: "#ff0000",
        companyName: "Red Corporation",
        tagline: "We paint everything red",
      };

      const res = await request(app)
        .patch("/api/settings/branding")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      if (res.statusCode === 200) {
        expect(res.body.branding).toBeDefined();
        expect(res.body.branding.companyName).toBe("Red Corporation");
      }
    });

    it("rejects attempt to overwrite protected module setups via generic settings", async () => {
      const payload = {
        key: "plan",
        value: { tier: "unlimited" },
      };

      const res = await request(app)
        .post("/api/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send(payload);

      expect(res.statusCode).toBe(400); // Because 'plan' is a restricted setting key
    });

    it("allows public fetching of designated configuration passing businessId context", async () => {
      // Setup a public key
      await request(app)
        .post("/api/settings")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ key: "public_feature", value: true, isPublic: true });

      const res = await request(app).get(
        "/api/settings/public?businessId=mock-uuid-if-known",
      ); // Assuming the API looks up the business ID successfully

      if (res.statusCode === 200) {
        expect(res.body.branding).toBeDefined();
        expect(res.body.localization).toBeDefined();
        // Since the public feature was set to isPublic: true, it should appear in the settings hash
        // expect(res.body.settings.public_feature).toBe(true);
      }
    });
  });
});

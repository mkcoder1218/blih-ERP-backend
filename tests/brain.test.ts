import request from "supertest";
import express from "express";
import { sanitizeArticleContent } from "../src/modules/brain/brain.sanitizer";

jest.mock("../src/middlewares/auth", () => ({
  authRequired: (req: any, _res: any, next: any) => next()
}));

jest.mock("../src/middlewares/module", () => ({
  requireActiveModule: () => (_req: any, _res: any, next: any) => next()
}));

import { brainRoutes } from "../src/modules/brain/brain.routes";

const app = express();
app.use(express.json());

// Inject test authorization
let mockUser: any = null;

app.use((req, res, next) => {
  if (mockUser) {
    req.user = mockUser;
  }
  next();
});

app.use("/api/v1/brain", brainRoutes);

describe("Brain Module Foundation Tests", () => {
  const bizA = "00000000-0000-0000-0000-000000000001";
  const bizB = "00000000-0000-0000-0000-000000000002";
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    mockUser = null;
  });

  describe("Rich-Text Sanitizer Utility", () => {
    it("strips script tags, event handlers, and dangerous iframe elements", () => {
      const maliciousHtml = `
        <h1>Safe Header</h1>
        <script>alert('xss')</script>
        <p onclick="alert('click')">Paragraph with <a href="javascript:alert(1)">bad link</a> and <a href="https://example.com">good link</a>.</p>
        <iframe src="https://malicious.com"></iframe>
      `;
      const { content, contentText } = sanitizeArticleContent(maliciousHtml);

      expect(content).toContain("<h1>Safe Header</h1>");
      expect(content).toContain('<a href="https://example.com" rel="noopener noreferrer">good link</a>');
      expect(content).not.toContain("<script>");
      expect(content).not.toContain("onclick");
      expect(content).not.toContain("javascript:");
      expect(content).not.toContain("<iframe>");

      expect(contentText).toBe("Safe Header Paragraph with bad link and good link.");
    });
  });

  describe("Route Guards & Permissions", () => {
    it("denies access if brain.access is missing", async () => {
      mockUser = {
        id: userA,
        businessId: bizA,
        permissions: []
      };

      const res = await request(app)
        .get("/api/v1/brain/categories")
        .set("Authorization", "Bearer test-token");
      expect(res.status).toBe(403);
    });

    it("allows platform super admin even without explicit brain permissions", async () => {
      mockUser = {
        id: userA,
        businessId: bizA,
        isPlatformSuperAdmin: true,
        permissions: []
      };

      const res = await request(app)
        .get("/api/v1/brain/categories")
        .set("Authorization", "Bearer test-token");
      // Middleware passes to service
      expect(res.status).not.toBe(403);
    });
  });
});

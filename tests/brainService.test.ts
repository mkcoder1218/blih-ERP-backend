import { BrainService } from "../src/modules/brain/brain.service";

describe("BrainService Business Rules & Security Logic", () => {
  let service: BrainService;
  const bizA = "00000000-0000-0000-0000-000000000001";
  const bizB = "00000000-0000-0000-0000-000000000002";
  const userA = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    service = new BrainService();
  });

  describe("canUserAccessArticle", () => {
    it("allows Super Admin access to all articles", () => {
      const user = { isPlatformSuperAdmin: true, businessId: bizA, id: userA };
      const article = { businessId: bizA, status: "draft", visibility: "private", authorUserId: "other" };
      expect(service.canUserAccessArticle(user, article, null)).toBe(true);
    });

    it("blocks readers from accessing non-published articles of other authors", () => {
      const user = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["brain.article.view"] };
      const article = { businessId: bizA, status: "draft", visibility: "company", authorUserId: "other-user" };
      expect(service.canUserAccessArticle(user, article, null)).toBe(false);
    });

    it("allows authors to view their own non-published articles", () => {
      const user = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["brain.article.view"] };
      const article = { businessId: bizA, status: "draft", visibility: "company", authorUserId: userA };
      expect(service.canUserAccessArticle(user, article, null)).toBe(true);
    });

    it("allows department members access to department visibility articles", () => {
      const user = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["brain.article.view"] };
      const article = {
        businessId: bizA,
        status: "published",
        visibility: "department",
        authorUserId: "other",
        metadata: { departmentIds: ["dept-100"] }
      };
      expect(service.canUserAccessArticle(user, article, "dept-100")).toBe(true);
      expect(service.canUserAccessArticle(user, article, "dept-200")).toBe(false);
    });

    it("restricts private visibility to author or elevated users", () => {
      const normalUser = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["brain.article.view"] };
      const elevatedUser = { isPlatformSuperAdmin: false, businessId: bizA, id: "editor-1", permissions: ["brain.article.view", "brain.article.update_any"] };
      const article = { businessId: bizA, status: "published", visibility: "private", authorUserId: userA };

      expect(service.canUserAccessArticle(normalUser, article, null)).toBe(true); // Is author
      expect(service.canUserAccessArticle(elevatedUser, article, null)).toBe(true); // Has update_any
      expect(service.canUserAccessArticle({ ...normalUser, id: "other" }, article, null)).toBe(false); // Reader & not author
    });
  });
});

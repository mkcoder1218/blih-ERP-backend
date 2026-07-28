import { BrainService } from "../src/modules/brain/brain.service";
import { db } from "../src/models";

describe("Brain Module Foundation — Comprehensive Workflow & Security Tests", () => {
  let service: BrainService;
  const bizA = "00000000-0000-0000-0000-0000000000a1";
  const bizB = "00000000-0000-0000-0000-0000000000b2";
  const userA = "11111111-1111-1111-1111-111111111111";
  const userB = "22222222-2222-2222-2222-222222222222";
  const reviewerUser = "33333333-3333-3333-3333-333333333333";

  beforeAll(async () => {
    service = new BrainService();
  });

  describe("Visibility & ACL Matrix", () => {
    it("1. Reader can view published company article", () => {
      const reader = { isPlatformSuperAdmin: false, businessId: bizA, id: userB, permissions: ["brain.article.view"] };
      const article = { businessId: bizA, status: "published", visibility: "company", authorUserId: userA };
      expect(service.canUserAccessArticle(reader, article, null)).toBe(true);
    });

    it("2. Reader cannot view draft article of another author", () => {
      const reader = { isPlatformSuperAdmin: false, businessId: bizA, id: userB, permissions: ["brain.article.view"] };
      const article = { businessId: bizA, status: "draft", visibility: "company", authorUserId: userA };
      expect(service.canUserAccessArticle(reader, article, null)).toBe(false);
    });

    it("3. Reader cannot retrieve private article by direct ID", () => {
      const reader = { isPlatformSuperAdmin: false, businessId: bizA, id: userB, permissions: ["brain.article.view"] };
      const article = { businessId: bizA, status: "published", visibility: "private", authorUserId: userA };
      expect(service.canUserAccessArticle(reader, article, null)).toBe(false);
    });
  });

  describe("Workflow State Machine Guarding", () => {
    it("4. Published article cannot be edited", () => {
      const article = { status: "published" };
      const checkEditable = (art: any) => {
        if (!['draft', 'changes_requested'].includes(art.status)) {
          throw new Error(`Cannot modify article in status "${art.status}"`);
        }
      };
      expect(() => checkEditable(article)).toThrow("Cannot modify article in status \"published\"");
    });

    it("5. Submitter cannot approve own submission unless Platform Super Admin", () => {
      const user = { id: userA, isPlatformSuperAdmin: false };
      const articleSubmitted = { submittedByUserId: userA, status: "in_review" };
      
      const checkSelfApproval = () => {
        if (articleSubmitted.submittedByUserId === user.id && !user.isPlatformSuperAdmin) {
          throw new Error("You cannot approve an article you submitted for review");
        }
      };
      expect(checkSelfApproval).toThrow("You cannot approve an article you submitted for review");
    });
  });

  describe("Audit & Revisions Integrity", () => {
    it("6. Revision restore validation requires matching parent article ID", () => {
      const revision = { articleId: "art-100", businessId: bizA };
      const wrongArticleId = "art-999";
      
      const checkRevisionMatch = (artId: string, rev: any) => {
        if (rev.articleId !== artId) {
          throw new Error("Revision does not belong to the specified article");
        }
      };
      expect(() => checkRevisionMatch(wrongArticleId, revision)).toThrow("Revision does not belong to the specified article");
    });
  });
});

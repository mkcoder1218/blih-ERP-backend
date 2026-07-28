import { ProcedureService } from "../src/modules/procedure/procedure.service";

describe("Procedure Service Business Rules & Security Logic", () => {
  let service: ProcedureService;
  const bizA = "00000000-0000-0000-0000-000000000001";
  const userA = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    service = new ProcedureService();
  });

  describe("canUserAccessProcedure", () => {
    it("allows Super Admin access to all procedures", () => {
      const user = { isPlatformSuperAdmin: true, businessId: bizA, id: userA };
      const procedure = { businessId: bizA, status: "draft", visibility: "private", authorUserId: "other" };
      expect(service.canUserAccessProcedure(user, procedure, null)).toBe(true);
    });

    it("blocks readers from accessing non-published procedures of other authors", () => {
      const user = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["procedures.procedure.view"] };
      const procedure = { businessId: bizA, status: "draft", visibility: "company", authorUserId: "other-user" };
      expect(service.canUserAccessProcedure(user, procedure, null)).toBe(false);
    });

    it("allows authors to view their own non-published procedures", () => {
      const user = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["procedures.procedure.view"] };
      const procedure = { businessId: bizA, status: "draft", visibility: "company", authorUserId: userA };
      expect(service.canUserAccessProcedure(user, procedure, null)).toBe(true);
    });

    it("allows department members access to department visibility procedures", () => {
      const user = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["procedures.procedure.view"] };
      const procedure = {
        businessId: bizA,
        status: "published",
        visibility: "department",
        authorUserId: "other",
        responsibleDepartmentId: "dept-100"
      };
      expect(service.canUserAccessProcedure(user, procedure, "dept-100")).toBe(true);
      expect(service.canUserAccessProcedure(user, procedure, "dept-200")).toBe(false);
    });

    it("restricts private visibility to author or elevated users", () => {
      const normalUser = { isPlatformSuperAdmin: false, businessId: bizA, id: userA, permissions: ["procedures.procedure.view"] };
      const elevatedUser = { isPlatformSuperAdmin: false, businessId: bizA, id: "editor-1", permissions: ["procedures.procedure.view", "procedures.procedure.update_any"] };
      const procedure = { businessId: bizA, status: "published", visibility: "private", authorUserId: userA };

      expect(service.canUserAccessProcedure(normalUser, procedure, null)).toBe(true); // Is author
      expect(service.canUserAccessProcedure(elevatedUser, procedure, null)).toBe(true); // Has update_any
      expect(service.canUserAccessProcedure({ ...normalUser, id: "other" }, procedure, null)).toBe(false); // Reader & not author
    });
  });
});

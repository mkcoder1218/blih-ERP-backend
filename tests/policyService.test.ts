import { PolicyService } from "../src/modules/policy/policy.service";
import { PolicyAssignmentService } from "../src/modules/policy/policy.assignment.service";

describe("PolicyService & Assignment Precedence Tests", () => {
  let policyService: PolicyService;
  let assignmentService: PolicyAssignmentService;

  const bizA = "00000000-0000-0000-0000-0000000000a1";
  const userA = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    policyService = new PolicyService();
    assignmentService = new PolicyAssignmentService();
  });

  describe("Assignment Precedence Resolver", () => {
    const employee = {
      id: "emp-100",
      userId: userA,
      departmentId: "dept-1",
      positionId: "pos-1"
    };

    it("EMPLOYEE EXCLUDE overrides COMPANY INCLUDE", () => {
      const assignments = [
        { subjectType: "COMPANY", subjectId: "ALL", assignmentType: "INCLUDE" },
        { subjectType: "EMPLOYEE", subjectId: "emp-100", assignmentType: "EXCLUDE" }
      ];
      expect(assignmentService.resolveEmployeeAssignment(employee, [], assignments)).toBe(false);
    });

    it("POSITION INCLUDE overrides DEPARTMENT EXCLUDE", () => {
      const assignments = [
        { subjectType: "DEPARTMENT", subjectId: "dept-1", assignmentType: "EXCLUDE" },
        { subjectType: "POSITION", subjectId: "pos-1", assignmentType: "INCLUDE" }
      ];
      expect(assignmentService.resolveEmployeeAssignment(employee, [], assignments)).toBe(true);
    });

    it("COMPANY INCLUDE targets employee if no higher exclusions match", () => {
      const assignments = [
        { subjectType: "COMPANY", subjectId: "ALL", assignmentType: "INCLUDE" }
      ];
      expect(assignmentService.resolveEmployeeAssignment(employee, [], assignments)).toBe(true);
    });
  });
});

import { db } from "../../models";
import { Op } from "sequelize";

export class PolicyAssignmentService {
  /**
   * Resolves whether an employee is targeted by a set of policy assignment rules.
   * Precedence: EMPLOYEE > POSITION > ROLE > DEPARTMENT > COMPANY
   * At equal level, EXCLUDE overrides INCLUDE.
   */
  resolveEmployeeAssignment(
    employee: { id: string; userId: string; departmentId?: string | null; positionId?: string | null },
    userRoles: string[],
    assignments: any[]
  ): boolean {
    if (!assignments || assignments.length === 0) {
      return false;
    }

    const levels = ["EMPLOYEE", "POSITION", "ROLE", "DEPARTMENT", "COMPANY"];

    for (const level of levels) {
      const matchingAssignments = assignments.filter((a) => a.subjectType === level);
      if (matchingAssignments.length === 0) continue;

      let matchedRules: any[] = [];

      if (level === "EMPLOYEE") {
        matchedRules = matchingAssignments.filter((a) => a.subjectId === employee.id || a.subjectId === employee.userId);
      } else if (level === "POSITION") {
        if (employee.positionId) {
          matchedRules = matchingAssignments.filter((a) => a.subjectId === employee.positionId);
        }
      } else if (level === "ROLE") {
        if (userRoles && userRoles.length > 0) {
          matchedRules = matchingAssignments.filter((a) => userRoles.includes(a.subjectId));
        }
      } else if (level === "DEPARTMENT") {
        if (employee.departmentId) {
          matchedRules = matchingAssignments.filter((a) => a.subjectId === employee.departmentId);
        }
      } else if (level === "COMPANY") {
        matchedRules = matchingAssignments;
      }

      if (matchedRules.length > 0) {
        // Equal specificity: EXCLUDE wins over INCLUDE
        const hasExclude = matchedRules.some((r) => r.assignmentType === "EXCLUDE");
        if (hasExclude) return false;

        const hasInclude = matchedRules.some((r) => r.assignmentType === "INCLUDE");
        if (hasInclude) return true;
      }
    }

    return false;
  }

  /**
   * Generates or updates PolicyAcceptance obligations for all active targeted employees in bounded chunks.
   */
  async generateAcceptanceObligations(
    businessId: string,
    policy: any,
    version: any,
    assignments: any[],
    transaction?: any
  ): Promise<number> {
    if (!policy.requiresAcceptance) {
      return 0;
    }

    // Fetch active employees for business in batches
    const chunkSize = 500;
    let offset = 0;
    let totalGenerated = 0;

    // Pre-fetch all user roles for the business to avoid N+1 queries
    const userRoleRows = await db.UserRole.findAll({
      include: [{ model: db.User, where: { businessId }, attributes: ["id"] }],
      attributes: ["userId", "roleId"],
      transaction
    });

    const userRolesMap = new Map<string, string[]>();
    for (const ur of userRoleRows) {
      const existing = userRolesMap.get(ur.userId) || [];
      existing.push(ur.roleId);
      userRolesMap.set(ur.userId, existing);
    }

    while (true) {
      const employees = await db.EmployeeRecord.findAll({
        where: { businessId, status: "active" },
        attributes: ["id", "userId", "departmentId", "positionId"],
        limit: chunkSize,
        offset,
        transaction
      });

      if (!employees || employees.length === 0) break;

      const obligationsToInsert: any[] = [];
      const now = new Date();
      const dueAt = version.effectiveFrom ? new Date(version.effectiveFrom) : new Date(now.getTime() + 14 * 86400000);

      for (const emp of employees) {
        const uRoles = userRolesMap.get(emp.userId) || [];
        const isAssigned = this.resolveEmployeeAssignment(emp, uRoles, assignments);

        if (isAssigned) {
          obligationsToInsert.push({
            businessId,
            policyId: policy.id,
            policyVersionId: version.id,
            userId: emp.userId,
            employeeId: emp.id,
            policyVersion: version.version,
            status: "pending",
            assignedAt: now,
            dueAt,
            metadata: {
              assignedBySystem: true,
              policyTitle: policy.title,
              versionLabel: version.versionLabel
            }
          });
        }
      }

      if (obligationsToInsert.length > 0) {
        // Bounded bulk insert with unique constraint protection (policyVersionId + employeeId)
        for (const row of obligationsToInsert) {
          const [acceptance, created] = await db.PolicyAcceptance.findOrCreate({
            where: {
              policyVersionId: row.policyVersionId,
              employeeId: row.employeeId
            },
            defaults: row,
            transaction
          });
          if (created) totalGenerated++;
        }
      }

      if (employees.length < chunkSize) break;
      offset += chunkSize;
    }

    return totalGenerated;
  }
}

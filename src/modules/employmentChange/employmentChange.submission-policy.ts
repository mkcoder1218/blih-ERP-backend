import { Op } from "sequelize";
import { db } from "../../models";

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

export class EmploymentChangeSubmissionPolicy {
  private async roleKeys(businessId: string, userId: string) {
    const assignments = await db.UserRole.findAll({ where: { userId } });
    const roleIds = assignments.map((row: any) => row.roleId);
    if (!roleIds.length) return new Set<string>();

    const roles = await db.Role.findAll({
      where: {
        id: { [Op.in]: roleIds },
        [Op.or]: [{ businessId }, { businessId: null }],
      },
      attributes: ["key"],
    });

    return new Set<string>(roles.map((role: any) => String(role.key)));
  }

  private async activeUsersForRole(businessId: string, roleKey: string) {
    const roles = await db.Role.findAll({
      where: {
        key: roleKey,
        [Op.or]: [{ businessId }, { businessId: null }],
      },
      attributes: ["id"],
    });
    const roleIds = roles.map((role: any) => role.id);
    if (!roleIds.length) return [];

    const assignments = await db.UserRole.findAll({
      where: { roleId: { [Op.in]: roleIds } },
      attributes: ["userId"],
    });
    const userIds = Array.from(
      new Set(assignments.map((row: any) => String(row.userId))),
    );
    if (!userIds.length) return [];

    return db.User.findAll({
      where: {
        id: { [Op.in]: userIds },
        businessId,
        status: "active",
      },
      attributes: ["id", "fullName", "email"],
    });
  }

  async validate(businessId: string, actorUserId: string, data: any) {
    const roles = await this.roleKeys(businessId, actorUserId);

    if (roles.has("BUSINESS_ADMIN") || roles.has("PLATFORM_SUPER_ADMIN")) {
      fail(
        "Business Admin / Super Admin cannot initiate employment changes because they are final approvers. Use employee, direct-manager, or HR initiation to preserve separation of duties.",
        403,
      );
    }

    const employeeUserId = String(data?.employeeUserId || actorUserId);
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: employeeUserId },
      attributes: ["userId", "managerUserId"],
    });
    if (!employee) {
      fail("Employee record not found.", 404);
    }

    if (!employee.managerUserId) {
      fail(
        "This employee has no reporting manager configured. Assign a reporting manager before submitting an employment change request.",
        409,
      );
    }

    const manager = await db.User.findOne({
      where: {
        id: employee.managerUserId,
        businessId,
        status: "active",
      },
      attributes: ["id", "fullName", "email"],
    });
    if (!manager) {
      fail(
        "The employee's reporting manager is not active. Assign an active reporting manager before submitting an employment change request.",
        409,
      );
    }

    const hasSalaryChange =
      data?.requestedSalary !== undefined ||
      data?.increasePercent !== undefined;

    if (!roles.has("HR_MANAGER")) {
      const hrApprovers = await this.activeUsersForRole(businessId, "HR_MANAGER");
      if (!hrApprovers.length) {
        fail(
          "No active HR Manager approver is configured. Assign the HR_MANAGER role before submitting employment changes.",
          409,
        );
      }
    }

    if (hasSalaryChange && !roles.has("FINANCE_MANAGER")) {
      const financeApprovers = await this.activeUsersForRole(
        businessId,
        "FINANCE_MANAGER",
      );
      if (!financeApprovers.length) {
        fail(
          "No active Finance Manager approver is configured. Assign the FINANCE_MANAGER role before submitting salary changes.",
          409,
        );
      }
    }

    const adminApprovers = await this.activeUsersForRole(businessId, "BUSINESS_ADMIN");
    if (!adminApprovers.length) {
      fail(
        "No active Business Admin final approver is configured. Assign the BUSINESS_ADMIN role before submitting employment changes.",
        409,
      );
    }
  }
}

import { Op } from "sequelize";
import { db } from "../../models";

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

export class EmploymentChangeContextService {
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

  async get(businessId: string, actorUserId: string, requestedEmployeeUserId?: string) {
    const employeeUserId = String(requestedEmployeeUserId || actorUserId);
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: employeeUserId },
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email", "status"] },
        { model: db.User, as: "manager", attributes: ["id", "fullName", "email"], required: false },
        { model: db.Department, as: "department", attributes: ["id", "name"], required: false },
        { model: db.Position, as: "position", attributes: ["id", "title", "departmentId"], required: false },
      ],
    });

    if (!employee) fail("Employee record not found.", 404);

    let allowed = employeeUserId === actorUserId || String(employee.managerUserId || "") === actorUserId;
    if (!allowed) {
      const roles = await this.roleKeys(businessId, actorUserId);
      allowed =
        roles.has("HR_MANAGER") ||
        roles.has("BUSINESS_ADMIN") ||
        roles.has("PLATFORM_SUPER_ADMIN");
    }
    if (!allowed) fail("You cannot initiate an employment change for this employee.", 403);

    const [positions, departments] = await Promise.all([
      db.Position.findAll({
        where: { businessId, status: "active" },
        attributes: ["id", "title", "departmentId", "level"],
        order: [["title", "ASC"]],
        limit: 1000,
      }),
      db.Department.findAll({
        where: { businessId },
        attributes: ["id", "name"],
        order: [["name", "ASC"]],
        limit: 1000,
      }),
    ]);

    const salaryInfo = employee.salaryInfo || {};
    const currentSalary = Number(
      salaryInfo.baseSalary ??
        salaryInfo.monthlySalary ??
        salaryInfo.salary ??
        0,
    );

    return {
      employee: {
        id: employee.user?.id || employee.userId,
        fullName: employee.user?.fullName || "Employee",
        email: employee.user?.email || null,
        manager: employee.manager || null,
      },
      current: {
        positionId: employee.positionId || null,
        title: employee.position?.title || null,
        departmentId: employee.departmentId || null,
        departmentName: employee.department?.name || null,
        salary: Number.isFinite(currentSalary) ? currentSalary : 0,
        currency: salaryInfo.currency || "ETB",
      },
      positions: positions.map((position: any) => position.toJSON()),
      departments: departments.map((department: any) => department.toJSON()),
    };
  }
}

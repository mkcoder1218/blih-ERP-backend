import { Op } from "sequelize";
import { db } from "../../models";
import { slugify } from "../../utils/slugify";
import { InternalNotifier } from "../notification/notification.service";
import {
  EmploymentChangeAction,
  EmploymentChangeRequest,
} from "./employmentChange.models";
import { sendEmploymentChangeStatusEmail } from "./employmentChange.mailer";

const PRIVILEGED_VIEW_ROLES = new Set([
  "HR_MANAGER",
  "FINANCE_MANAGER",
  "BUSINESS_ADMIN",
  "PLATFORM_SUPER_ADMIN",
]);

const IMMEDIATE_TITLE_ROLES = new Set([
  "HR_MANAGER",
  "BUSINESS_ADMIN",
  "PLATFORM_SUPER_ADMIN",
]);

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter(Boolean) as string[]));
}

export class EmploymentChangeManagementService {
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

  private async accessWhere(businessId: string, actorUserId: string) {
    const roles = await this.roleKeys(businessId, actorUserId);
    const privileged = Array.from(roles).some((role) => PRIVILEGED_VIEW_ROLES.has(role));

    if (privileged) {
      return { roles, where: { businessId } as any };
    }

    const directReports = await db.EmployeeRecord.findAll({
      where: { businessId, managerUserId: actorUserId },
      attributes: ["userId"],
    });
    const reportIds = directReports.map((row: any) => String(row.userId));

    const accessOr: any[] = [
      { employeeUserId: actorUserId },
      { requestedByUserId: actorUserId },
      { currentApproverUserId: actorUserId },
    ];

    if (reportIds.length) {
      accessOr.push({ employeeUserId: { [Op.in]: reportIds } });
    }

    return {
      roles,
      where: {
        businessId,
        [Op.or]: accessOr,
      } as any,
    };
  }

  private approvalWhere(actorUserId: string, roles: Set<string>) {
    const or: any[] = [{ currentApproverUserId: actorUserId }];
    if (roles.size) {
      or.push({ currentApproverRoleKey: { [Op.in]: Array.from(roles) } });
    }
    return { status: "PENDING", [Op.or]: or } as any;
  }

  private async buildWhere(
    businessId: string,
    actorUserId: string,
    query: any,
  ) {
    const { roles, where: access } = await this.accessWhere(businessId, actorUserId);
    const and: any[] = [access];
    const scope = String(query.scope || "visible").toLowerCase();

    if (scope === "mine") {
      and.push({ requestedByUserId: actorUserId });
    } else if (scope === "approvals") {
      and.push(this.approvalWhere(actorUserId, roles));
    }

    if (query.status && String(query.status).toUpperCase() !== "ALL") {
      and.push({ status: String(query.status).toUpperCase() });
    }
    if (query.requestKind && String(query.requestKind).toUpperCase() !== "ALL") {
      and.push({ requestKind: String(query.requestKind).toUpperCase() });
    }
    if (query.approvalStage && String(query.approvalStage).toUpperCase() !== "ALL") {
      and.push({ approvalStage: String(query.approvalStage).toUpperCase() });
    }
    if (query.employeeUserId) {
      and.push({ employeeUserId: String(query.employeeUserId) });
    }
    if (query.dateFrom) {
      and.push({ effectiveDate: { [Op.gte]: String(query.dateFrom).slice(0, 10) } });
    }
    if (query.dateTo) {
      and.push({ effectiveDate: { [Op.lte]: String(query.dateTo).slice(0, 10) } });
    }

    const search = String(query.search || "").trim();
    if (search) {
      const users = await db.User.findAll({
        where: {
          businessId,
          [Op.or]: [
            { fullName: { [Op.iLike]: `%${search}%` } },
            { email: { [Op.iLike]: `%${search}%` } },
          ],
        },
        attributes: ["id"],
        limit: 250,
      });
      const userIds = users.map((user: any) => String(user.id));
      const searchOr: any[] = [
        { currentTitle: { [Op.iLike]: `%${search}%` } },
        { targetTitle: { [Op.iLike]: `%${search}%` } },
        { reason: { [Op.iLike]: `%${search}%` } },
      ];
      if (userIds.length) searchOr.push({ employeeUserId: { [Op.in]: userIds } });
      and.push({ [Op.or]: searchOr });
    }

    return { roles, where: { [Op.and]: and } as any };
  }

  private async hydrateRows(
    businessId: string,
    actorUserId: string,
    roles: Set<string>,
    rows: any[],
  ) {
    if (!rows.length) return [];

    const userIds = unique(
      rows.flatMap((request) => [
        String(request.employeeUserId),
        String(request.requestedByUserId),
        request.currentApproverUserId ? String(request.currentApproverUserId) : null,
      ]),
    );
    const positionIds = unique(
      rows.flatMap((request) => [
        request.targetPositionId ? String(request.targetPositionId) : null,
      ]),
    );
    const departmentIds = unique(
      rows.flatMap((request) => [
        request.targetDepartmentId ? String(request.targetDepartmentId) : null,
      ]),
    );

    const [users, employees, positions, departments] = await Promise.all([
      db.User.findAll({
        where: { businessId, id: { [Op.in]: userIds } },
        attributes: ["id", "fullName", "email"],
      }),
      db.EmployeeRecord.findAll({
        where: { businessId, userId: { [Op.in]: userIds } },
        include: [
          { model: db.Department, as: "department", attributes: ["id", "name"], required: false },
          { model: db.Position, as: "position", attributes: ["id", "title"], required: false },
          { model: db.User, as: "manager", attributes: ["id", "fullName", "email"], required: false },
        ],
      }),
      positionIds.length
        ? db.Position.findAll({
            where: { businessId, id: { [Op.in]: positionIds } },
            attributes: ["id", "title", "departmentId"],
          })
        : [],
      departmentIds.length
        ? db.Department.findAll({
            where: { businessId, id: { [Op.in]: departmentIds } },
            attributes: ["id", "name"],
          })
        : [],
    ]);

    const userMap = new Map(users.map((user: any) => [String(user.id), user.toJSON()]));
    const employeeMap = new Map(employees.map((employee: any) => [String(employee.userId), employee]));
    const positionMap = new Map(positions.map((position: any) => [String(position.id), position.toJSON()]));
    const departmentMap = new Map(departments.map((department: any) => [String(department.id), department.toJSON()]));
    const canCancelRole = Array.from(roles).some((role) =>
      ["HR_MANAGER", "BUSINESS_ADMIN", "PLATFORM_SUPER_ADMIN"].includes(role),
    );

    return rows.map((request) => {
      const employeeRecord = employeeMap.get(String(request.employeeUserId));
      const employeeUser = userMap.get(String(request.employeeUserId));
      const requester = userMap.get(String(request.requestedByUserId));
      const currentApprover = request.currentApproverUserId
        ? userMap.get(String(request.currentApproverUserId))
        : null;
      const canApprove =
        request.status === "PENDING" &&
        (String(request.currentApproverUserId || "") === actorUserId ||
          (request.currentApproverRoleKey && roles.has(String(request.currentApproverRoleKey))));
      const finalSalary = request.recommendedSalary ?? request.requestedSalary;
      const currentSalary = Number(request.currentSalary || 0);
      const increaseAmount = finalSalary != null ? Number(finalSalary) - currentSalary : null;

      return {
        ...request.toJSON(),
        employee: employeeUser
          ? {
              ...employeeUser,
              manager: employeeRecord?.manager || null,
              department: employeeRecord?.department || null,
              position: employeeRecord?.position || null,
            }
          : null,
        requester: requester || null,
        currentApprover: currentApprover || null,
        targetPosition: request.targetPositionId
          ? positionMap.get(String(request.targetPositionId)) || null
          : null,
        targetDepartment: request.targetDepartmentId
          ? departmentMap.get(String(request.targetDepartmentId)) || null
          : null,
        finalSalary,
        increaseAmount,
        increasePercent:
          increaseAmount !== null && currentSalary > 0
            ? (increaseAmount / currentSalary) * 100
            : null,
        canApprove,
        canCounter:
          canApprove &&
          (request.requestKind === "SALARY" || request.requestKind === "COMBINED"),
        canCancel:
          canCancelRole && !["APPLIED", "REJECTED", "CANCELLED"].includes(String(request.status)),
      };
    });
  }

  async list(businessId: string, actorUserId: string, query: any = {}) {
    const page = Math.max(1, Number(query.page || 1));
    const size = Math.min(100, Math.max(5, Number(query.size || 10)));
    const { roles, where } = await this.buildWhere(businessId, actorUserId, query);

    const { rows, count } = await EmploymentChangeRequest.findAndCountAll({
      where,
      order: [["createdAt", "DESC"]],
      offset: (page - 1) * size,
      limit: size,
      distinct: true,
    });

    return {
      rows: await this.hydrateRows(businessId, actorUserId, roles, rows),
      pagination: {
        page,
        size,
        total: count,
        totalPages: Math.max(1, Math.ceil(count / size)),
      },
    };
  }

  async analytics(businessId: string, actorUserId: string) {
    const { roles, where: access } = await this.accessWhere(businessId, actorUserId);
    const startOfMonth = new Date();
    startOfMonth.setUTCDate(1);
    startOfMonth.setUTCHours(0, 0, 0, 0);

    const count = (extra: any = {}) =>
      EmploymentChangeRequest.count({ where: { [Op.and]: [access, extra] } });

    const [
      total,
      pending,
      scheduled,
      applied,
      rejected,
      cancelled,
      titleOnly,
      salaryOnly,
      combined,
      appliedThisMonth,
      awaitingMyApproval,
    ] = await Promise.all([
      count(),
      count({ status: "PENDING" }),
      count({ status: "SCHEDULED" }),
      count({ status: "APPLIED" }),
      count({ status: "REJECTED" }),
      count({ status: "CANCELLED" }),
      count({ requestKind: "TITLE" }),
      count({ requestKind: "SALARY" }),
      count({ requestKind: "COMBINED" }),
      count({ status: "APPLIED", appliedAt: { [Op.gte]: startOfMonth } }),
      EmploymentChangeRequest.count({
        where: {
          [Op.and]: [access, this.approvalWhere(actorUserId, roles)],
        },
      }),
    ]);

    return {
      total,
      pending,
      awaitingMyApproval,
      scheduled,
      applied,
      appliedThisMonth,
      rejected,
      cancelled,
      byType: {
        title: titleOnly,
        salary: salaryOnly,
        combined,
      },
    };
  }

  private async ensureImmediatePosition(
    businessId: string,
    targetPositionId: string | null,
    targetTitle: string | null,
    targetDepartmentId: string | null,
    requestId: string,
  ) {
    if (targetPositionId) {
      const position = await db.Position.findOne({
        where: { id: targetPositionId, businessId, status: "active" },
      });
      if (!position) fail("Selected position was not found.", 404);
      return position;
    }

    const title = String(targetTitle || "").trim();
    if (!title) fail("Select a position or enter a title.");
    if (!targetDepartmentId) fail("Department is required for a free-text title.");

    const existing = await db.Position.findOne({
      where: {
        businessId,
        departmentId: targetDepartmentId,
        title: { [Op.iLike]: title },
        status: "active",
      },
    });
    if (existing) return existing;

    let key = slugify(title) || "position";
    const duplicate = await db.Position.findOne({ where: { businessId, key } });
    if (duplicate) key = `${key}-${requestId.slice(0, 8)}`;

    return db.Position.create({
      businessId,
      departmentId: targetDepartmentId,
      title,
      key,
      level: 1,
      description: "Created from an immediate employee title change.",
      status: "active",
    });
  }

  async immediateTitleChange(businessId: string, actorUserId: string, data: any) {
    const roles = await this.roleKeys(businessId, actorUserId);
    if (!Array.from(roles).some((role) => IMMEDIATE_TITLE_ROLES.has(role))) {
      fail("Only HR Manager or Business Admin authority can apply an immediate title change.", 403);
    }

    const employeeUserId = String(data.employeeUserId || "");
    if (!employeeUserId) fail("employeeUserId is required.");

    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: employeeUserId },
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email"] },
        { model: db.Position, as: "position", attributes: ["id", "title", "departmentId"], required: false },
        { model: db.Department, as: "department", attributes: ["id", "name"], required: false },
      ],
    });
    if (!employee) fail("Employee record not found.", 404);

    const reason = String(data.reason || "").trim();
    if (!reason) fail("Reason is required for an immediate title change.");

    const request = await EmploymentChangeRequest.create({
      businessId,
      employeeUserId,
      requestedByUserId: actorUserId,
      requestKind: "TITLE",
      titleChangeType: String(data.titleChangeType || "PROMOTION").toUpperCase(),
      currentPositionId: employee.positionId || null,
      currentTitle: employee.position?.title || null,
      targetPositionId: data.targetPositionId || null,
      targetTitle: String(data.targetTitle || "").trim() || null,
      currentDepartmentId: employee.departmentId || null,
      targetDepartmentId: data.targetDepartmentId || employee.departmentId || null,
      currentSalary: null,
      requestedSalary: null,
      recommendedSalary: null,
      reason,
      effectiveDate: todayYmd(),
      status: "APPLIED",
      approvalStage: "COMPLETED",
      approvedAt: new Date(),
      appliedAt: new Date(),
      currentApproverUserId: null,
      currentApproverRoleKey: null,
      metadata: {
        source: "IMMEDIATE_PROFILE_TITLE_CHANGE",
        immediate: true,
        bypassedApproval: true,
      },
    });

    try {
      const position = await this.ensureImmediatePosition(
        businessId,
        data.targetPositionId ? String(data.targetPositionId) : null,
        data.targetTitle ? String(data.targetTitle) : null,
        data.targetDepartmentId ? String(data.targetDepartmentId) : employee.departmentId || null,
        String(request.id),
      );
      const departmentId =
        data.targetDepartmentId || position.departmentId || employee.departmentId || null;

      await employee.update({
        positionId: position.id,
        ...(departmentId ? { departmentId } : {}),
      });

      const profile = await db.BusinessUserProfile.findOne({
        where: { businessId, userId: employeeUserId },
      });
      if (profile) {
        await profile.update({
          positionId: position.id,
          ...(departmentId ? { departmentId } : {}),
        });
      }

      await request.update({
        targetPositionId: position.id,
        targetTitle: position.title,
        targetDepartmentId: departmentId,
        metadata: {
          ...(request.metadata || {}),
          appliedSnapshot: {
            before: {
              positionId: employee.positionId || null,
              title: employee.position?.title || null,
              departmentId: employee.departmentId || null,
            },
            after: {
              positionId: position.id,
              title: position.title,
              departmentId,
            },
          },
        },
      });

      await EmploymentChangeAction.create({
        businessId,
        requestId: request.id,
        actorUserId,
        stage: "IMMEDIATE",
        action: "IMMEDIATE_APPLIED",
        comment: reason,
        beforeData: {
          positionId: employee.positionId || null,
          title: employee.position?.title || null,
          departmentId: employee.departmentId || null,
        },
        afterData: {
          positionId: position.id,
          title: position.title,
          departmentId,
        },
      });

      await InternalNotifier.send({
        businessId,
        senderUserId: actorUserId,
        recipientUserId: employeeUserId,
        moduleKey: "hr",
        type: "employment_change_status",
        title: "Title updated",
        message: `Your title has been updated to ${position.title}.`,
        entityType: "employment_change_request",
        entityId: request.id,
        priority: "normal",
      });

      if (employee.user?.email) {
        await sendEmploymentChangeStatusEmail({
          to: employee.user.email,
          recipientName: employee.user.fullName,
          employeeName: employee.user.fullName,
          request,
          heading: "Title updated",
          message: `Your title has been updated immediately to ${position.title}.`,
        });
      }

      return {
        request: await request.reload(),
        employee: {
          id: employeeUserId,
          fullName: employee.user?.fullName || "Employee",
          position: { id: position.id, title: position.title },
          departmentId,
        },
      };
    } catch (error) {
      await request.destroy({ force: true }).catch(() => undefined);
      throw error;
    }
  }
}

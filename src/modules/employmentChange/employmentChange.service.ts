import { Op } from "sequelize";
import { db } from "../../models";
import { slugify } from "../../utils/slugify";
import { InternalNotifier } from "../notification/notification.service";
import { PayrollTemplateService } from "../finance/payrollTemplate.service";
import {
  EmploymentChangeAction,
  EmploymentChangeRequest,
} from "./employmentChange.models";
import {
  sendEmploymentChangeReviewEmail,
  sendEmploymentChangeStatusEmail,
} from "./employmentChange.mailer";

const TITLE_CHANGE_TYPES = new Set([
  "PROMOTION",
  "LATERAL_TITLE_CHANGE",
  "DEMOTION",
  "CORRECTION",
]);

const OPEN_STATUSES = ["PENDING", "APPROVED", "SCHEDULED"];
const TERMINAL_STATUSES = new Set(["APPLIED", "REJECTED", "CANCELLED"]);

type ApprovalTarget = {
  stage: "MANAGER" | "HR" | "FINANCE" | "ADMIN";
  userId?: string;
  roleKey?: "HR_MANAGER" | "FINANCE_MANAGER" | "BUSINESS_ADMIN";
};

function fail(message: string, statusCode = 400): never {
  throw Object.assign(new Error(message), { statusCode });
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

export class EmploymentChangeService {
  private payroll = new PayrollTemplateService();

  private salaryFromEmployee(employee: any) {
    return Number(
      employee?.salaryInfo?.baseSalary ??
        employee?.salaryInfo?.monthlySalary ??
        employee?.salaryInfo?.salary ??
        0,
    );
  }

  private async employee(businessId: string, userId: string) {
    return db.EmployeeRecord.findOne({
      where: { businessId, userId },
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email", "status"] },
        { model: db.User, as: "manager", attributes: ["id", "fullName", "email", "status"], required: false },
        { model: db.Department, as: "department", attributes: ["id", "name"], required: false },
        { model: db.Position, as: "position", attributes: ["id", "title", "departmentId"], required: false },
      ],
    });
  }

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

  private async usersForRole(businessId: string, roleKey: string) {
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
    const userIds = unique(assignments.map((row: any) => String(row.userId)));
    if (!userIds.length) return [];

    return db.User.findAll({
      where: { id: { [Op.in]: userIds }, businessId, status: "active" },
      attributes: ["id", "fullName", "email", "status"],
      order: [["fullName", "ASC"]],
    });
  }

  private async buildApprovalChain(
    businessId: string,
    employee: any,
    requesterUserId: string,
    hasSalaryChange: boolean,
  ) {
    const requesterRoles = await this.roleKeys(businessId, requesterUserId);
    const chain: ApprovalTarget[] = [];
    const skippedStages: string[] = [];

    if (employee.managerUserId && String(employee.managerUserId) !== requesterUserId) {
      const manager = await db.User.findOne({
        where: { id: employee.managerUserId, businessId, status: "active" },
        attributes: ["id"],
      });
      if (manager) chain.push({ stage: "MANAGER", userId: String(manager.id) });
      else skippedStages.push("MANAGER:NO_ACTIVE_MANAGER");
    } else {
      skippedStages.push(
        employee.managerUserId ? "MANAGER:REQUESTER_IS_MANAGER" : "MANAGER:NO_MANAGER",
      );
    }

    if (!requesterRoles.has("HR_MANAGER") && !requesterRoles.has("BUSINESS_ADMIN")) {
      const hrUsers = await this.usersForRole(businessId, "HR_MANAGER");
      if (hrUsers.length) chain.push({ stage: "HR", roleKey: "HR_MANAGER" });
      else skippedStages.push("HR:NO_APPROVER");
    } else {
      skippedStages.push("HR:REQUESTER_HAS_HR_AUTHORITY");
    }

    if (hasSalaryChange) {
      if (!requesterRoles.has("FINANCE_MANAGER") && !requesterRoles.has("BUSINESS_ADMIN")) {
        const financeUsers = await this.usersForRole(businessId, "FINANCE_MANAGER");
        if (financeUsers.length) chain.push({ stage: "FINANCE", roleKey: "FINANCE_MANAGER" });
        else skippedStages.push("FINANCE:NO_APPROVER");
      } else {
        skippedStages.push("FINANCE:REQUESTER_HAS_FINANCE_AUTHORITY");
      }
    }

    if (!requesterRoles.has("BUSINESS_ADMIN")) {
      const admins = await this.usersForRole(businessId, "BUSINESS_ADMIN");
      if (admins.length) chain.push({ stage: "ADMIN", roleKey: "BUSINESS_ADMIN" });
      else skippedStages.push("ADMIN:NO_APPROVER");
    } else {
      skippedStages.push("ADMIN:REQUESTER_IS_BUSINESS_ADMIN");
    }

    return { chain, skippedStages };
  }

  private approvalTargetAt(request: any, index: number): ApprovalTarget | null {
    const chain = Array.isArray(request.metadata?.approvalChain)
      ? request.metadata.approvalChain
      : [];
    return chain[index] || null;
  }

  private async setApprovalTarget(request: any, index: number) {
    const target = this.approvalTargetAt(request, index);
    if (!target) return false;

    await request.update({
      approvalStage: target.stage,
      currentApproverUserId: target.userId || null,
      currentApproverRoleKey: target.roleKey || null,
      metadata: {
        ...(request.metadata || {}),
        approvalIndex: index,
      },
    });

    return true;
  }

  private async canActAsCurrentApprover(businessId: string, actorUserId: string, request: any) {
    if (request.currentApproverUserId) {
      return String(request.currentApproverUserId) === actorUserId;
    }
    if (!request.currentApproverRoleKey) return false;
    const roles = await this.roleKeys(businessId, actorUserId);
    return roles.has(String(request.currentApproverRoleKey));
  }

  private async isPrivilegedViewer(businessId: string, userId: string) {
    const roles = await this.roleKeys(businessId, userId);
    return (
      roles.has("HR_MANAGER") ||
      roles.has("FINANCE_MANAGER") ||
      roles.has("BUSINESS_ADMIN") ||
      roles.has("PLATFORM_SUPER_ADMIN")
    );
  }

  private async canView(businessId: string, userId: string, request: any) {
    if (
      String(request.employeeUserId) === userId ||
      String(request.requestedByUserId) === userId ||
      String(request.currentApproverUserId || "") === userId
    ) {
      return true;
    }

    if (await this.isPrivilegedViewer(businessId, userId)) return true;

    if (request.currentApproverRoleKey) {
      const roles = await this.roleKeys(businessId, userId);
      if (roles.has(String(request.currentApproverRoleKey))) return true;
    }

    const employee = await db.EmployeeRecord.findOne({
      where: { businessId, userId: request.employeeUserId },
      attributes: ["managerUserId"],
    });
    return String(employee?.managerUserId || "") === userId;
  }

  private async canInitiateFor(businessId: string, actorUserId: string, employee: any) {
    if (String(employee.userId) === actorUserId) return true;
    if (String(employee.managerUserId || "") === actorUserId) return true;
    const roles = await this.roleKeys(businessId, actorUserId);
    return roles.has("HR_MANAGER") || roles.has("BUSINESS_ADMIN") || roles.has("PLATFORM_SUPER_ADMIN");
  }

  private async action(input: {
    businessId: string;
    requestId: string;
    actorUserId?: string | null;
    stage?: string | null;
    action: string;
    comment?: string | null;
    beforeData?: any;
    afterData?: any;
  }) {
    return EmploymentChangeAction.create({
      businessId: input.businessId,
      requestId: input.requestId,
      actorUserId: input.actorUserId || null,
      stage: input.stage || null,
      action: input.action,
      comment: input.comment || null,
      beforeData: input.beforeData ?? null,
      afterData: input.afterData ?? null,
    });
  }

  private async approversForRequest(businessId: string, request: any) {
    if (request.currentApproverUserId) {
      const user = await db.User.findOne({
        where: { id: request.currentApproverUserId, businessId, status: "active" },
        attributes: ["id", "fullName", "email"],
      });
      return user ? [user] : [];
    }
    if (request.currentApproverRoleKey) {
      return this.usersForRole(businessId, String(request.currentApproverRoleKey));
    }
    return [];
  }

  private async notifyCurrentApprovers(businessId: string, request: any) {
    const [employee, requester, approvers] = await Promise.all([
      db.User.findOne({ where: { id: request.employeeUserId, businessId }, attributes: ["id", "fullName", "email"] }),
      db.User.findOne({ where: { id: request.requestedByUserId, businessId }, attributes: ["id", "fullName", "email"] }),
      this.approversForRequest(businessId, request),
    ]);

    for (const approver of approvers) {
      await InternalNotifier.send({
        businessId,
        senderUserId: request.requestedByUserId,
        recipientUserId: approver.id,
        moduleKey: "hr",
        type: "employment_change_approval",
        title: "Employment change approval",
        message: `${employee?.fullName || "An employee"} has an employment change request awaiting your ${String(request.approvalStage).toLowerCase()} review.`,
        entityType: "employment_change_request",
        entityId: request.id,
        priority: request.requestKind === "SALARY" || request.requestKind === "COMBINED" ? "high" : "normal",
      });

      if (approver.email) {
        await sendEmploymentChangeReviewEmail({
          to: approver.email,
          approverName: approver.fullName,
          employeeName: employee?.fullName || "Employee",
          requesterName: requester?.fullName || "A teammate",
          request,
        });
      }
    }
  }

  private async notifyParticipants(
    businessId: string,
    request: any,
    heading: string,
    message: string,
    senderUserId?: string | null,
  ) {
    const recipientIds = unique([
      String(request.employeeUserId),
      String(request.requestedByUserId),
    ]);
    const users = await db.User.findAll({
      where: { id: { [Op.in]: recipientIds }, businessId },
      attributes: ["id", "fullName", "email"],
    });
    const employee = users.find((user: any) => String(user.id) === String(request.employeeUserId));

    for (const user of users) {
      await InternalNotifier.send({
        businessId,
        senderUserId: senderUserId || undefined,
        recipientUserId: user.id,
        moduleKey: "hr",
        type: "employment_change_status",
        title: heading,
        message,
        entityType: "employment_change_request",
        entityId: request.id,
        priority: "normal",
      });

      if (user.email) {
        await sendEmploymentChangeStatusEmail({
          to: user.email,
          recipientName: user.fullName,
          employeeName: employee?.fullName || "Employee",
          request,
          heading,
          message,
        });
      }
    }
  }

  async create(businessId: string, actorUserId: string, data: any) {
    const employeeUserId = String(data.employeeUserId || actorUserId);
    const employee = await this.employee(businessId, employeeUserId);
    if (!employee) fail("Employee record not found.", 404);
    if (!(await this.canInitiateFor(businessId, actorUserId, employee))) {
      fail("You cannot initiate an employment change for this employee.", 403);
    }

    const duplicate = await EmploymentChangeRequest.findOne({
      where: {
        businessId,
        employeeUserId,
        status: { [Op.in]: OPEN_STATUSES },
      },
    });
    if (duplicate) {
      fail("This employee already has an active employment change request. HR must cancel or replace it first.", 409);
    }

    const reason = String(data.reason || data.justification || "").trim();
    if (!reason) fail("Reason / justification is required.");

    const effectiveDate = String(data.effectiveDate || todayYmd()).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) fail("effectiveDate must be YYYY-MM-DD.");

    const currentSalary = this.salaryFromEmployee(employee);
    let requestedSalary: number | null = null;
    if (data.requestedSalary !== undefined && data.requestedSalary !== null && data.requestedSalary !== "") {
      requestedSalary = Number(data.requestedSalary);
    } else if (data.increasePercent !== undefined && data.increasePercent !== null && data.increasePercent !== "") {
      requestedSalary = currentSalary * (1 + Number(data.increasePercent) / 100);
    }
    if (requestedSalary !== null && (!Number.isFinite(requestedSalary) || requestedSalary <= 0)) {
      fail("Requested salary must be a positive number.");
    }
    if (requestedSalary !== null && requestedSalary <= currentSalary) {
      fail("Salary increase request must be greater than the current salary.");
    }

    let targetPosition: any = null;
    if (data.targetPositionId) {
      targetPosition = await db.Position.findOne({
        where: { id: String(data.targetPositionId), businessId, status: "active" },
        attributes: ["id", "title", "departmentId"],
      });
      if (!targetPosition) fail("Selected target position was not found.", 404);
    }

    const targetTitle = String(data.targetTitle || targetPosition?.title || "").trim() || null;
    const hasTitleChange = Boolean(targetTitle || targetPosition);
    const hasSalaryChange = requestedSalary !== null;
    if (!hasTitleChange && !hasSalaryChange) {
      fail("Add a title change, salary increase, or both.");
    }

    const titleChangeType = hasTitleChange
      ? String(data.titleChangeType || "LATERAL_TITLE_CHANGE").toUpperCase()
      : null;
    if (titleChangeType && !TITLE_CHANGE_TYPES.has(titleChangeType)) {
      fail("Invalid titleChangeType.");
    }

    const targetDepartmentId = hasTitleChange
      ? String(data.targetDepartmentId || targetPosition?.departmentId || employee.departmentId || "") || null
      : null;
    if (targetDepartmentId) {
      const department = await db.Department.findOne({ where: { id: targetDepartmentId, businessId } });
      if (!department) fail("Target department not found.", 404);
    }

    const requestKind = hasTitleChange && hasSalaryChange
      ? "COMBINED"
      : hasTitleChange
        ? "TITLE"
        : "SALARY";

    const { chain, skippedStages } = await this.buildApprovalChain(
      businessId,
      employee,
      actorUserId,
      hasSalaryChange,
    );

    const first = chain[0] || null;
    const request = await EmploymentChangeRequest.create({
      businessId,
      employeeUserId,
      requestedByUserId: actorUserId,
      requestKind,
      titleChangeType,
      currentPositionId: employee.positionId || null,
      currentTitle: employee.position?.title || null,
      targetPositionId: targetPosition?.id || null,
      targetTitle,
      currentDepartmentId: employee.departmentId || null,
      targetDepartmentId,
      currentSalary: hasSalaryChange ? currentSalary : null,
      requestedSalary,
      recommendedSalary: null,
      reason,
      effectiveDate,
      attachmentUrl: data.attachmentUrl || null,
      status: "PENDING",
      approvalStage: first?.stage || "ADMIN",
      currentApproverUserId: first?.userId || null,
      currentApproverRoleKey: first?.roleKey || null,
      metadata: {
        approvalChain: chain,
        approvalIndex: 0,
        skippedStages,
        source: data.source || (employeeUserId === actorUserId ? "SELF_SERVICE" : "MANAGER_OR_HR"),
        originalRequestedSalary: requestedSalary,
      },
    });

    await this.action({
      businessId,
      requestId: request.id,
      actorUserId,
      stage: "SUBMISSION",
      action: "SUBMITTED",
      comment: reason,
      afterData: request.toJSON(),
    });

    await this.notifyParticipants(
      businessId,
      request,
      "Employment change submitted",
      "Your employment change request has been submitted for approval.",
      actorUserId,
    );

    if (!chain.length) {
      await this.finalizeApproval(businessId, request, actorUserId);
    } else {
      await this.notifyCurrentApprovers(businessId, request);
    }

    return this.get(businessId, actorUserId, request.id);
  }

  async list(businessId: string, actorUserId: string, query: any = {}) {
    const where: any = { businessId };
    if (query.status) where.status = String(query.status).toUpperCase();
    if (query.employeeUserId) where.employeeUserId = String(query.employeeUserId);
    const rows = await EmploymentChangeRequest.findAll({
      where,
      order: [["createdAt", "DESC"]],
      limit: Math.min(Number(query.size || 100), 250),
    });

    const scope = String(query.scope || "").toLowerCase();
    const visible: any[] = [];
    for (const request of rows) {
      if (!(await this.canView(businessId, actorUserId, request))) continue;
      if (scope === "mine" && String(request.employeeUserId) !== actorUserId && String(request.requestedByUserId) !== actorUserId) continue;
      if (scope === "approvals" && !(await this.canActAsCurrentApprover(businessId, actorUserId, request))) continue;
      visible.push(await this.hydrate(businessId, actorUserId, request));
    }
    return visible;
  }

  async get(businessId: string, actorUserId: string, id: string) {
    const request = await EmploymentChangeRequest.findOne({ where: { id, businessId } });
    if (!request) fail("Employment change request not found.", 404);
    if (!(await this.canView(businessId, actorUserId, request))) fail("You cannot view this request.", 403);
    return this.hydrate(businessId, actorUserId, request);
  }

  async history(businessId: string, actorUserId: string, id: string) {
    await this.get(businessId, actorUserId, id);
    const rows = await EmploymentChangeAction.findAll({
      where: { businessId, requestId: id },
      order: [["createdAt", "ASC"]],
    });
    const actorIds = unique(rows.map((row: any) => String(row.actorUserId || "")).filter(Boolean));
    const actors = actorIds.length
      ? await db.User.findAll({
          where: { id: { [Op.in]: actorIds }, businessId },
          attributes: ["id", "fullName", "email"],
        })
      : [];
    const actorMap = new Map(actors.map((user: any) => [String(user.id), user.toJSON()]));
    return rows.map((row: any) => ({
      ...row.toJSON(),
      actor: row.actorUserId ? actorMap.get(String(row.actorUserId)) || null : null,
    }));
  }

  async approve(businessId: string, actorUserId: string, id: string, comment?: string) {
    return this.decide(businessId, actorUserId, id, "APPROVED", comment || null);
  }

  async counter(
    businessId: string,
    actorUserId: string,
    id: string,
    recommendedSalary: number,
    comment: string,
  ) {
    const request = await EmploymentChangeRequest.findOne({ where: { id, businessId } });
    if (!request) fail("Employment change request not found.", 404);
    if (request.requestKind !== "SALARY" && request.requestKind !== "COMBINED") {
      fail("A salary counter-offer is only valid for salary changes.");
    }
    const salary = Number(recommendedSalary);
    if (!Number.isFinite(salary) || salary <= 0) fail("recommendedSalary must be positive.");
    if (!String(comment || "").trim()) fail("A comment is required for a salary counter-offer.");
    await request.update({ recommendedSalary: salary });
    return this.decide(businessId, actorUserId, id, "COUNTERED", String(comment).trim());
  }

  async reject(businessId: string, actorUserId: string, id: string, reason: string) {
    const comment = String(reason || "").trim();
    if (!comment) fail("A rejection reason is required.");
    const request = await EmploymentChangeRequest.findOne({ where: { id, businessId } });
    if (!request) fail("Employment change request not found.", 404);
    if (request.status !== "PENDING") fail("Only pending requests can be rejected.");
    if (!(await this.canActAsCurrentApprover(businessId, actorUserId, request))) {
      fail("This request is not awaiting your approval.", 403);
    }

    const before = request.toJSON();
    await request.update({
      status: "REJECTED",
      rejectedAt: new Date(),
      currentApproverUserId: null,
      currentApproverRoleKey: null,
    });
    await this.action({
      businessId,
      requestId: request.id,
      actorUserId,
      stage: before.approvalStage,
      action: "REJECTED",
      comment,
      beforeData: before,
      afterData: request.toJSON(),
    });
    await this.notifyParticipants(
      businessId,
      request,
      "Employment change rejected",
      `The employment change request was rejected. Reason: ${comment}`,
      actorUserId,
    );
    return this.get(businessId, actorUserId, request.id);
  }

  private async decide(
    businessId: string,
    actorUserId: string,
    id: string,
    action: "APPROVED" | "COUNTERED",
    comment: string | null,
  ) {
    const request = await EmploymentChangeRequest.findOne({ where: { id, businessId } });
    if (!request) fail("Employment change request not found.", 404);
    if (request.status !== "PENDING") fail("Only pending requests can be approved.");
    if (!(await this.canActAsCurrentApprover(businessId, actorUserId, request))) {
      fail("This request is not awaiting your approval.", 403);
    }

    const before = request.toJSON();
    const currentIndex = Number(request.metadata?.approvalIndex || 0);
    await this.action({
      businessId,
      requestId: request.id,
      actorUserId,
      stage: request.approvalStage,
      action,
      comment,
      beforeData: before,
      afterData: {
        recommendedSalary: request.recommendedSalary,
      },
    });

    const moved = await this.setApprovalTarget(request, currentIndex + 1);
    if (moved) {
      await this.notifyParticipants(
        businessId,
        request,
        "Employment change approval updated",
        `${String(before.approvalStage).replace(/_/g, " ")} approval completed. The request moved to ${String(request.approvalStage).replace(/_/g, " ")} review.`,
        actorUserId,
      );
      await this.notifyCurrentApprovers(businessId, request);
      return this.get(businessId, actorUserId, request.id);
    }

    await this.finalizeApproval(businessId, request, actorUserId);
    return this.get(businessId, actorUserId, request.id);
  }

  private async finalizeApproval(businessId: string, request: any, actorUserId: string) {
    const future = String(request.effectiveDate) > todayYmd();
    await request.update({
      status: future ? "SCHEDULED" : "APPROVED",
      approvalStage: "COMPLETED",
      currentApproverUserId: null,
      currentApproverRoleKey: null,
      approvedAt: new Date(),
      scheduledAt: future ? new Date() : null,
    });

    await this.action({
      businessId,
      requestId: request.id,
      actorUserId,
      stage: "COMPLETED",
      action: future ? "SCHEDULED" : "FINAL_APPROVED",
      afterData: request.toJSON(),
    });

    if (future) {
      await this.notifyParticipants(
        businessId,
        request,
        "Employment change approved",
        `The request is fully approved and scheduled for ${request.effectiveDate}.`,
        actorUserId,
      );
      return;
    }

    await this.applyRequest(businessId, request, actorUserId);
  }

  async cancel(businessId: string, actorUserId: string, id: string, reason?: string) {
    const request = await EmploymentChangeRequest.findOne({ where: { id, businessId } });
    if (!request) fail("Employment change request not found.", 404);
    if (TERMINAL_STATUSES.has(String(request.status))) fail("This request is already closed.");

    const roles = await this.roleKeys(businessId, actorUserId);
    if (!roles.has("HR_MANAGER") && !roles.has("BUSINESS_ADMIN") && !roles.has("PLATFORM_SUPER_ADMIN")) {
      fail("Only HR or Business Admin can cancel/replace an active employment change request.", 403);
    }

    const before = request.toJSON();
    await request.update({
      status: "CANCELLED",
      cancelledAt: new Date(),
      currentApproverUserId: null,
      currentApproverRoleKey: null,
    });
    await this.action({
      businessId,
      requestId: request.id,
      actorUserId,
      stage: request.approvalStage,
      action: "CANCELLED",
      comment: String(reason || "").trim() || null,
      beforeData: before,
      afterData: request.toJSON(),
    });
    await this.notifyParticipants(
      businessId,
      request,
      "Employment change cancelled",
      "The active employment change request was cancelled by HR/Admin.",
      actorUserId,
    );
    return this.get(businessId, actorUserId, request.id);
  }

  private async ensureFreeTextPosition(businessId: string, request: any, employee: any) {
    if (request.targetPositionId) {
      const existing = await db.Position.findOne({
        where: { id: request.targetPositionId, businessId },
      });
      if (!existing) fail("Approved target position no longer exists.", 409);
      return existing;
    }

    const title = String(request.targetTitle || "").trim();
    if (!title) return null;
    const departmentId = request.targetDepartmentId || employee.departmentId;
    if (!departmentId) fail("A department is required before a free-text title can be applied.", 409);

    const existing = await db.Position.findOne({
      where: {
        businessId,
        departmentId,
        title: { [Op.iLike]: title },
        status: "active",
      },
    });
    if (existing) return existing;

    let key = slugify(title) || "position";
    const duplicateKey = await db.Position.findOne({ where: { businessId, key } });
    if (duplicateKey) key = `${key}-${String(request.id).slice(0, 8)}`;

    return db.Position.create({
      businessId,
      departmentId,
      title,
      key,
      level: 1,
      description: "Created from approved employment title change request.",
      status: "active",
    });
  }

  async applyRequest(businessId: string, requestOrId: any, actorUserId?: string | null) {
    const request = typeof requestOrId === "string"
      ? await EmploymentChangeRequest.findOne({ where: { id: requestOrId, businessId } })
      : requestOrId;
    if (!request) fail("Employment change request not found.", 404);
    if (!["APPROVED", "SCHEDULED"].includes(String(request.status))) {
      return request;
    }

    const employee = await this.employee(businessId, String(request.employeeUserId));
    if (!employee) fail("Employee record no longer exists.", 409);

    const before = {
      positionId: employee.positionId || null,
      title: employee.position?.title || null,
      departmentId: employee.departmentId || null,
      salaryInfo: employee.salaryInfo || {},
    };

    const employeeUpdates: any = {};
    const profileUpdates: any = {};

    if (request.requestKind === "TITLE" || request.requestKind === "COMBINED") {
      const targetPosition = await this.ensureFreeTextPosition(businessId, request, employee);
      if (targetPosition) {
        employeeUpdates.positionId = targetPosition.id;
        profileUpdates.positionId = targetPosition.id;
      }
      const departmentId = request.targetDepartmentId || targetPosition?.departmentId || employee.departmentId || null;
      if (departmentId) {
        employeeUpdates.departmentId = departmentId;
        profileUpdates.departmentId = departmentId;
      }
    }

    if (Object.keys(employeeUpdates).length) await employee.update(employeeUpdates);
    if (Object.keys(profileUpdates).length) {
      const profile = await db.BusinessUserProfile.findOne({
        where: { businessId, userId: request.employeeUserId },
      });
      if (profile) await profile.update(profileUpdates);
    }

    if (request.requestKind === "SALARY" || request.requestKind === "COMBINED") {
      const finalSalary = Number(request.recommendedSalary ?? request.requestedSalary);
      if (!Number.isFinite(finalSalary) || finalSalary <= 0) fail("Approved salary is invalid.", 409);
      await this.payroll.updateEmployeeBaseSalaryWithEthiopianTax(
        businessId,
        actorUserId || request.requestedByUserId,
        request.employeeUserId,
        { baseSalary: finalSalary },
      );
    }

    const reloadedEmployee = await this.employee(businessId, String(request.employeeUserId));
    const after = {
      positionId: reloadedEmployee?.positionId || null,
      title: reloadedEmployee?.position?.title || request.targetTitle || null,
      departmentId: reloadedEmployee?.departmentId || null,
      salaryInfo: reloadedEmployee?.salaryInfo || {},
    };

    await request.update({
      status: "APPLIED",
      appliedAt: new Date(),
      metadata: {
        ...(request.metadata || {}),
        appliedSnapshot: { before, after },
      },
    });

    await this.action({
      businessId,
      requestId: request.id,
      actorUserId: actorUserId || null,
      stage: "EFFECTIVE_DATE",
      action: "APPLIED",
      beforeData: before,
      afterData: after,
    });

    await this.notifyParticipants(
      businessId,
      request,
      "Employment change is now effective",
      "The approved title/salary change has been applied to the employee profile and payroll configuration.",
      actorUserId || undefined,
    );

    return request.reload();
  }

  async applyDueChanges() {
    const rows = await EmploymentChangeRequest.findAll({
      where: {
        status: "SCHEDULED",
        effectiveDate: { [Op.lte]: todayYmd() },
      },
      order: [["effectiveDate", "ASC"]],
      limit: 250,
    });

    let applied = 0;
    const failed: Array<{ id: string; message: string }> = [];
    for (const request of rows) {
      try {
        await this.applyRequest(request.businessId, request, null);
        applied += 1;
      } catch (error: any) {
        failed.push({ id: request.id, message: error?.message || "Apply failed" });
      }
    }
    return { scanned: rows.length, applied, failed };
  }

  private async hydrate(businessId: string, actorUserId: string, request: any) {
    const [employee, requester, currentApprover, targetPosition, targetDepartment] = await Promise.all([
      this.employee(businessId, String(request.employeeUserId)),
      db.User.findOne({
        where: { id: request.requestedByUserId, businessId },
        attributes: ["id", "fullName", "email"],
      }),
      request.currentApproverUserId
        ? db.User.findOne({
            where: { id: request.currentApproverUserId, businessId },
            attributes: ["id", "fullName", "email"],
          })
        : null,
      request.targetPositionId
        ? db.Position.findOne({ where: { id: request.targetPositionId, businessId }, attributes: ["id", "title", "departmentId"] })
        : null,
      request.targetDepartmentId
        ? db.Department.findOne({ where: { id: request.targetDepartmentId, businessId }, attributes: ["id", "name"] })
        : null,
    ]);

    const canApprove = request.status === "PENDING"
      ? await this.canActAsCurrentApprover(businessId, actorUserId, request)
      : false;
    const roles = await this.roleKeys(businessId, actorUserId);
    const canCancel = !TERMINAL_STATUSES.has(String(request.status)) &&
      (roles.has("HR_MANAGER") || roles.has("BUSINESS_ADMIN") || roles.has("PLATFORM_SUPER_ADMIN"));
    const finalSalary = request.recommendedSalary ?? request.requestedSalary;
    const currentSalary = Number(request.currentSalary || 0);
    const increase = finalSalary != null ? Number(finalSalary) - currentSalary : null;

    return {
      ...request.toJSON(),
      employee: employee?.user
        ? {
            id: employee.user.id,
            fullName: employee.user.fullName,
            email: employee.user.email,
            manager: employee.manager || null,
            department: employee.department || null,
            position: employee.position || null,
          }
        : null,
      requester: requester?.toJSON?.() || requester || null,
      currentApprover: currentApprover?.toJSON?.() || currentApprover || null,
      targetPosition: targetPosition?.toJSON?.() || targetPosition || null,
      targetDepartment: targetDepartment?.toJSON?.() || targetDepartment || null,
      finalSalary,
      increaseAmount: increase,
      increasePercent: increase !== null && currentSalary > 0 ? (increase / currentSalary) * 100 : null,
      canApprove,
      canCounter: canApprove && (request.requestKind === "SALARY" || request.requestKind === "COMBINED"),
      canCancel,
    };
  }
}

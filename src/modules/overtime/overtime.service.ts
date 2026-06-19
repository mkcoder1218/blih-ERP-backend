import { OvertimeDAL, type OvertimeListFilters } from "./overtime.dal";
import { InternalNotifier } from "../notification/notification.service";
import { db } from "../../models";

export const ROLE_STAGE_MAP: Record<string, string> = {
  DEPT_HEAD: "department_head",
  DEPARTMENT_HEAD: "department_head",
  MANAGER: "department_head",
  BUSINESS_ADMIN: "admin",
  CEO: "admin",
  HR: "admin",
  HR_MANAGER: "admin",
};

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60_000));
}

export class OvertimeService {
  private dal = new OvertimeDAL();

  async submit(businessId: string, employeeUserId: string, data: any) {
    const requestedDate = data.requestedDate || data.overtimeDate;
    if (!requestedDate) throw new Error("requestedDate is required");
    if (!data.reason || !String(data.reason).trim()) throw new Error("reason is required");

    const expectedDurationMinutes = data.expectedDurationMinutes == null ? null : Number(data.expectedDurationMinutes);
    if (expectedDurationMinutes != null && (!Number.isFinite(expectedDurationMinutes) || expectedDurationMinutes <= 0)) {
      throw new Error("expectedDurationMinutes must be a positive number");
    }
    if (!expectedDurationMinutes && !data.expectedEndTime && !data.endTime) {
      throw new Error("expectedDurationMinutes or expectedEndTime is required");
    }

    if (!data.allowDuplicateActive) {
      const duplicate = await this.dal.findActiveForEmployeeDate(businessId, employeeUserId, requestedDate);
      if (duplicate) throw new Error("Duplicate active overtime request exists for this employee and date");
    }

    const record = await this.dal.create({
      businessId,
      employeeUserId,
      requestedDate,
      overtimeDate: requestedDate,
      startTime: data.startTime || null,
      endTime: data.endTime || data.expectedEndTime || null,
      totalMinutes: 0,
      expectedDurationMinutes,
      expectedEndTime: data.expectedEndTime || data.endTime || null,
      overtimeType: data.overtimeType || "Regular",
      reason: data.reason,
      requestedAtUtc: new Date(),
      requestedBy: data.requestedBy || employeeUserId,
      approvalStage: "department_head",
      status: "pending",
    });

    await this._notifyRoleUsers(businessId, ["DEPT_HEAD", "DEPARTMENT_HEAD", "MANAGER"], {
      senderUserId: employeeUserId,
      type: "overtime_manager_review",
      title: "New Overtime Request",
      message: "A new overtime request is awaiting manager approval.",
      entityId: record.id,
    });

    return record;
  }

  listForEmployee(businessId: string, userId: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId, employeeUserId: userId });
  }

  listAll(businessId: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId });
  }

  listPendingForStage(businessId: string, _stage: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId, status: "pending" });
  }

  listActiveApproved(businessId: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId, status: "approved" });
  }

  listClosedHistory(businessId: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId, status: "closed" });
  }

  getById(id: string, businessId: string) {
    return this.dal.findById(id, businessId);
  }

  async approve(id: string, businessId: string, actorUserId: string, stage: string, comment?: string) {
    const record = await this._assertPending(id, businessId);
    const now = new Date();
    const update = {
      ...this._stageFields(stage, actorUserId, comment),
      approvalStage: "approved",
      status: "approved",
      approvedBy: actorUserId,
      approvedAtUtc: now,
      overtimeStartedAtUtc: now,
    };

    await this.dal.update(id, businessId, update);

    await InternalNotifier.send({
      businessId,
      recipientUserId: record.employeeUserId,
      senderUserId: actorUserId,
      moduleKey: "attendance",
      type: "overtime_approved_started",
      title: "Overtime Request Approved",
      message: "Your overtime request has been approved. Overtime starts from the manager approval time.",
      entityType: "overtime_request",
      entityId: id,
      priority: "high",
    });

    return this.dal.findById(id, businessId);
  }

  async reject(id: string, businessId: string, actorUserId: string, stage: string, reason: string) {
    const record = await this._assertPending(id, businessId);

    await this.dal.update(id, businessId, {
      ...this._stageFields(stage, actorUserId, reason),
      approvalStage: "rejected",
      status: "rejected",
      rejectedAt: new Date(),
      rejectedBy: actorUserId,
      rejectionReason: reason || "No reason provided",
    });

    await InternalNotifier.send({
      businessId,
      recipientUserId: record.employeeUserId,
      senderUserId: actorUserId,
      moduleKey: "attendance",
      type: "overtime_rejected",
      title: "Overtime Request Rejected",
      message: `Your overtime request was rejected. Reason: ${reason || "No reason provided"}`,
      entityType: "overtime_request",
      entityId: id,
      priority: "normal",
    });

    return this.dal.findById(id, businessId);
  }

  async close(id: string, businessId: string, actorUserId: string) {
    const record = await this.dal.findById(id, businessId);
    if (!record) throw new Error("Overtime request not found");
    if (record.status !== "approved") throw new Error("Only approved overtime requests can be closed");
    if (!record.overtimeStartedAtUtc) throw new Error("Cannot close overtime before approval");

    const now = new Date();
    const approvedOvertimeMinutes = minutesBetween(new Date(record.overtimeStartedAtUtc), now);
    await this.dal.update(id, businessId, {
      approvalStage: "closed",
      status: "closed",
      closedBy: actorUserId,
      closedAtUtc: now,
      overtimeClosedAtUtc: now,
      approvedOvertimeMinutes,
      totalMinutes: approvedOvertimeMinutes,
    });

    await InternalNotifier.send({
      businessId,
      recipientUserId: record.employeeUserId,
      senderUserId: actorUserId,
      moduleKey: "attendance",
      type: "overtime_closed",
      title: "Overtime Closed",
      message: "Your overtime request has been closed by a manager.",
      entityType: "overtime_request",
      entityId: id,
      priority: "normal",
    });

    return this.dal.findById(id, businessId);
  }

  async cancel(id: string, businessId: string, employeeUserId: string) {
    const record = await this.dal.findById(id, businessId);
    if (!record) throw new Error("Not found");
    if (record.employeeUserId !== employeeUserId) throw new Error("Forbidden");
    if (record.status !== "pending") throw new Error("Only pending overtime requests can be cancelled");

    await this.dal.update(id, businessId, {
      status: "cancelled",
      approvalStage: "cancelled",
    });

    return this.dal.findById(id, businessId);
  }

  private async _assertPending(id: string, businessId: string) {
    const record = await this.dal.findById(id, businessId);
    if (!record) throw new Error("Overtime request not found");
    if (record.status !== "pending") throw new Error("Request is not pending");
    return record;
  }

  private _stageFields(stage: string, actorUserId: string, comment?: string) {
    const now = new Date();
    if (stage === "department_head") return { deptHeadApprovedBy: actorUserId, deptHeadActionAt: now, deptHeadComment: comment };
    if (stage === "admin") return { adminApprovedBy: actorUserId, adminActionAt: now, adminComment: comment };
    if (stage === "finance") return { financeApprovedBy: actorUserId, financeActionAt: now, financeComment: comment };
    return {};
  }

  private async _notifyRoleUsers(businessId: string, roleKeys: string[], payload: any) {
    try {
      const roles = await db.Role.findAll({ where: { businessId, key: roleKeys } });
      if (!roles.length) return;
      const roleIds = roles.map((r: any) => r.id);
      const userRoles = await db.UserRole.findAll({ where: { roleId: roleIds } });
      const userIds: string[] = Array.from(new Set(userRoles.map((ur: any) => ur.userId as string)));

      for (const recipientUserId of userIds) {
        await InternalNotifier.send({
          businessId,
          recipientUserId,
          senderUserId: payload.senderUserId,
          moduleKey: "attendance",
          type: payload.type,
          title: payload.title,
          message: payload.message,
          entityType: "overtime_request",
          entityId: payload.entityId,
          priority: "high",
        });
      }
    } catch (err) {
      console.error("[OvertimeService] Failed to notify role users:", err);
    }
  }
}

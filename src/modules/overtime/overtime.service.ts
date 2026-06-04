import { OvertimeDAL, type OvertimeListFilters } from "./overtime.dal";
import { InternalNotifier } from "../notification/notification.service";
import { db } from "../../models";

// Maps a role to the stage it can act on
export const ROLE_STAGE_MAP: Record<string, string> = {
  DEPT_HEAD:      "department_head",
  DEPARTMENT_HEAD:"department_head",
  BUSINESS_ADMIN: "admin",
  CEO:            "admin",
  FINANCE:        "finance",
  FINANCE_MANAGER:"finance",
};

// The sequential order of stages
const STAGE_ORDER = ["department_head", "admin", "finance"];

export class OvertimeService {
  private dal = new OvertimeDAL();

  // ── Employee submits a new request ─────────────────────────────────────────
  async submit(businessId: string, employeeUserId: string, data: any) {
    const start = data.startTime as string; // "HH:mm"
    const end = data.endTime as string;
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    const totalMinutes = Math.max(0, (eh * 60 + em) - (sh * 60 + sm));

    const record = await this.dal.create({
      businessId,
      employeeUserId,
      overtimeDate: data.overtimeDate,
      startTime: start,
      endTime: end,
      totalMinutes,
      overtimeType: data.overtimeType || "Regular",
      reason: data.reason,
      approvalStage: "department_head",
      status: "pending",
    });

    // Notify all dept-head role users in this business
    await this._notifyRoleUsers(businessId, ["DEPT_HEAD", "DEPARTMENT_HEAD"], {
      senderUserId: employeeUserId,
      type: "overtime_dept_head_review",
      title: "New Overtime Request",
      message: "A new overtime request is awaiting your review.",
      entityId: record.id,
    });

    return record;
  }

  // ── List requests (employee sees own; approver sees their stage) ────────────
  listForEmployee(businessId: string, userId: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId, employeeUserId: userId });
  }

  listAll(businessId: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({ ...filters, businessId });
  }

  // ── List pending requests for a specific approver stage ────────────────────
  listPendingForStage(businessId: string, stage: string, filters: Partial<OvertimeListFilters>) {
    return this.dal.findPaginated({
      ...filters,
      businessId,
      approvalStage: stage,
      status: "pending",
    });
  }

  getById(id: string, businessId: string) {
    return this.dal.findById(id, businessId);
  }

  // ── Approve at a given stage ────────────────────────────────────────────────
  async approve(id: string, businessId: string, actorUserId: string, stage: string, comment?: string) {
    const record = await this._assertPending(id, businessId, stage);

    const currentIndex = STAGE_ORDER.indexOf(stage);
    const nextStage = STAGE_ORDER[currentIndex + 1];
    const isFinal = !nextStage;

    const stageFields = this._stageFields(stage, actorUserId, comment);
    const update: any = {
      ...stageFields,
      approvalStage: isFinal ? "approved" : nextStage,
      status: isFinal ? "approved" : "pending",
    };

    await this.dal.update(id, businessId, update);
    const updated = await this.dal.findById(id, businessId);

    if (isFinal) {
      // Notify the employee — fully approved
      await InternalNotifier.send({
        businessId,
        recipientUserId: record.employeeUserId,
        senderUserId: actorUserId,
        moduleKey: "attendance",
        type: "overtime_fully_approved",
        title: "Overtime Request Approved",
        message: "Your overtime request has been fully approved by all approvers.",
        entityType: "overtime_request",
        entityId: id,
        priority: "high",
      });
    } else {
      // Notify next stage approvers
      const nextRoles = Object.entries(ROLE_STAGE_MAP)
        .filter(([, s]) => s === nextStage)
        .map(([r]) => r);

      await this._notifyRoleUsers(businessId, nextRoles, {
        senderUserId: actorUserId,
        type: `overtime_${nextStage.replace("_", "")}_review`,
        title: "Overtime Request Needs Your Approval",
        message: `An overtime request has been approved by the ${stage.replace("_", " ")} and is now awaiting your review.`,
        entityId: id,
      });
    }

    return updated;
  }

  // ── Reject at a given stage ─────────────────────────────────────────────────
  async reject(id: string, businessId: string, actorUserId: string, stage: string, reason: string) {
    const record = await this._assertPending(id, businessId, stage);

    await this.dal.update(id, businessId, {
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

  // ── Cancel own request ──────────────────────────────────────────────────────
  async cancel(id: string, businessId: string, employeeUserId: string) {
    const record = await this.dal.findById(id, businessId);
    if (!record) throw new Error("Not found");
    if (record.employeeUserId !== employeeUserId) throw new Error("Forbidden");
    if (record.status === "approved" || record.status === "rejected") {
      throw new Error("Cannot cancel a closed request");
    }
    await this.dal.update(id, businessId, {
      status: "cancelled",
      approvalStage: "cancelled",
    });
    return this.dal.findById(id, businessId);
  }

  // ── private helpers ─────────────────────────────────────────────────────────
  private async _assertPending(id: string, businessId: string, stage: string) {
    const record = await this.dal.findById(id, businessId);
    if (!record) throw new Error("Overtime request not found");
    if (record.status !== "pending") throw new Error("Request is not pending");
    if (record.approvalStage !== stage) {
      throw new Error(`This request is currently at the '${record.approvalStage}' stage, not '${stage}'`);
    }
    return record;
  }

  private _stageFields(stage: string, actorUserId: string, comment?: string) {
    const now = new Date();
    if (stage === "department_head") return { deptHeadApprovedBy: actorUserId, deptHeadActionAt: now, deptHeadComment: comment };
    if (stage === "admin")           return { adminApprovedBy: actorUserId, adminActionAt: now, adminComment: comment };
    if (stage === "finance")         return { financeApprovedBy: actorUserId, financeActionAt: now, financeComment: comment };
    return {};
  }

  private async _notifyRoleUsers(businessId: string, roleKeys: string[], payload: any) {
    try {
      // Find all Role IDs for the given keys in this business
      const roles = await db.Role.findAll({ where: { businessId, key: roleKeys } });
      if (!roles.length) return;
      const roleIds = roles.map((r: any) => r.id);

      // Find all UserRole entries for those roles
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

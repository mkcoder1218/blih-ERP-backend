import { LeaveTemplateDAL, LeaveRequestDAL, type LeaveListFilters } from "./leave.dal";
import { InternalNotifier } from "../notification/notification.service";
import { db } from "../../models";

// Maps role key → approval stage
export const LEAVE_ROLE_STAGE_MAP: Record<string, string> = {
  DEPT_HEAD:        "dept_head",
  DEPARTMENT_HEAD:  "dept_head",
  HR_MANAGER:       "admin",
  BUSINESS_ADMIN:   "admin",
  CEO:              "admin",
};

const STAGE_ORDER = ["dept_head", "admin"];

export class LeaveService {
  private templateDAL = new LeaveTemplateDAL();
  private requestDAL  = new LeaveRequestDAL();

  // ── Templates ──────────────────────────────────────────────────────────────

  listTemplates(businessId: string, onlyActive?: boolean) {
    return this.templateDAL.list(businessId, onlyActive);
  }

  async createTemplate(businessId: string, createdBy: string, data: any) {
    return this.templateDAL.create({
      ...data,
      hasAmount: data.hasAmount !== false,
      totalDays: data.hasAmount === false ? 0 : data.totalDays,
      requiresEvidence: Boolean(data.requiresEvidence),
      evidenceInstructions: data.evidenceInstructions || null,
      businessId,
      createdBy
    });
  }

  async updateTemplate(id: string, businessId: string, data: any) {
    const patch = { ...data };
    if (Object.prototype.hasOwnProperty.call(patch, "requiresEvidence")) {
      patch.requiresEvidence = Boolean(patch.requiresEvidence);
    }
    if (Object.prototype.hasOwnProperty.call(patch, "hasAmount")) {
      patch.hasAmount = patch.hasAmount !== false;
      if (!patch.hasAmount) patch.totalDays = 0;
    }
    if (Object.prototype.hasOwnProperty.call(patch, "evidenceInstructions")) {
      patch.evidenceInstructions = patch.evidenceInstructions || null;
    }
    return this.templateDAL.update(id, businessId, patch);
  }

  async toggleTemplate(id: string, businessId: string) {
    const tpl = await this.templateDAL.findById(id, businessId);
    if (!tpl) throw new Error("Template not found");
    return tpl.update({ isActive: !tpl.isActive });
  }

  async deleteTemplate(id: string, businessId: string) {
    // Prevent deleting if there are pending requests against it
    const pending = await db.LeaveRequest.count({
      where: { businessId, leaveTemplateId: id, status: "pending" },
    });
    if (pending > 0) throw new Error("Cannot delete a template with pending requests. Please resolve them first.");
    return this.templateDAL.delete(id, businessId);
  }

  // ── Leave Requests ─────────────────────────────────────────────────────────

  async submit(businessId: string, employeeUserId: string, data: any) {
    // 1. Template must be active
    const tpl = await this.templateDAL.findById(data.leaveTemplateId, businessId);
    if (!tpl) throw new Error("Leave template not found");
    if (!tpl.isActive) throw new Error("This leave type is not currently active");
    const evidenceUrl = String(data.evidenceUrl || "").trim();
    const evidenceNote = String(data.evidenceNote || "").trim();
    if (tpl.requiresEvidence && !evidenceUrl && !evidenceNote) {
      throw new Error("Evidence is required for this leave type.");
    }

    // 2. Calculate business days
    const totalDays = this._countWorkdays(data.startDate, data.endDate);
    if (totalDays <= 0) throw new Error("End date must be after start date");

    // 3. Check balance when this leave type uses an allowance
    const year = new Date().getFullYear();
    if (tpl.hasAmount !== false) {
      let bal = await db.LeaveBalance.findOne({
        where: { businessId, userId: employeeUserId, leaveType: tpl.leaveType, year },
      });
      // Auto-provision balance if missing (use template's totalDays as the entitlement)
      if (!bal) {
        bal = await db.LeaveBalance.create({
          businessId,
          userId: employeeUserId,
          leaveType: tpl.leaveType,
          totalDays: tpl.totalDays,
          usedDays: 0,
          remainingDays: tpl.totalDays,
          year,
        });
      }
      if (bal.remainingDays < totalDays) {
        throw new Error(
          `Insufficient leave balance. You have ${bal.remainingDays} day(s) remaining but requested ${totalDays} day(s).`
        );
      }
    }

    // 4. Create the request
    const record = await this.requestDAL.create({
      businessId,
      employeeUserId,
      leaveTemplateId: tpl.id,
      leaveType: tpl.leaveType,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
      reason: data.reason,
      evidenceUrl: evidenceUrl || null,
      evidenceNote: evidenceNote || null,
      approvalStage: "dept_head",
      status: "pending",
    });

    // 5. Notify dept heads
    await this._notifyRoleUsers(businessId, ["DEPT_HEAD", "DEPARTMENT_HEAD"], {
      senderUserId: employeeUserId,
      type: "leave_dept_head_review",
      title: "New Leave Request",
      message: "A new leave request is awaiting your review.",
      entityId: record.id,
    });

    return record;
  }

  listForEmployee(businessId: string, userId: string, filters: Partial<LeaveListFilters>) {
    return this.requestDAL.findPaginated({ ...filters, businessId, employeeUserId: userId });
  }

  listAll(businessId: string, filters: Partial<LeaveListFilters>) {
    return this.requestDAL.findPaginated({ ...filters, businessId });
  }

  listPendingForStage(businessId: string, stage: string, filters: Partial<LeaveListFilters>) {
    return this.requestDAL.findPaginated({ ...filters, businessId, approvalStage: stage, status: "pending" });
  }

  getById(id: string, businessId: string) {
    return this.requestDAL.findById(id, businessId);
  }

  async approve(id: string, businessId: string, actorUserId: string, stage: string, comment?: string) {
    const record = await this._assertPending(id, businessId, stage);
    const currentIndex = STAGE_ORDER.indexOf(stage);
    const nextStage = STAGE_ORDER[currentIndex + 1];
    const isFinal = !nextStage;

    const stageFields = this._stageFields(stage, actorUserId, comment);
    await this.requestDAL.update(id, businessId, {
      ...stageFields,
      approvalStage: isFinal ? "approved" : nextStage,
      status: isFinal ? "approved" : "pending",
    });

    if (isFinal) {
      // Deduct balance
      const year = new Date().getFullYear();
      const template = record.template || await this.templateDAL.findById(record.leaveTemplateId, businessId);
      if (template?.hasAmount !== false) {
        const bal = await db.LeaveBalance.findOne({
          where: { businessId, userId: record.employeeUserId, leaveType: record.leaveType, year },
        });
        if (bal) {
          await bal.update({
            usedDays: bal.usedDays + record.totalDays,
            remainingDays: Math.max(0, bal.remainingDays - record.totalDays),
          });
        }
      }
      // Notify employee
      await InternalNotifier.send({
        businessId,
        recipientUserId: record.employeeUserId,
        senderUserId: actorUserId,
        moduleKey: "attendance",
        type: "leave_fully_approved",
        title: "Leave Request Approved",
        message: "Your leave request has been fully approved.",
        entityType: "leave_request",
        entityId: id,
        priority: "high",
      });
    } else {
      // Notify next-stage approvers
      const nextRoles = Object.entries(LEAVE_ROLE_STAGE_MAP)
        .filter(([, s]) => s === nextStage)
        .map(([r]) => r);
      await this._notifyRoleUsers(businessId, nextRoles, {
        senderUserId: actorUserId,
        type: "leave_admin_review",
        title: "Leave Request Needs Your Approval",
        message: "A leave request is awaiting admin approval.",
        entityId: id,
      });
    }

    return this.requestDAL.findById(id, businessId);
  }

  async reject(id: string, businessId: string, actorUserId: string, stage: string, reason: string) {
    const record = await this._assertPending(id, businessId, stage);
    await this.requestDAL.update(id, businessId, {
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
      type: "leave_rejected",
      title: "Leave Request Rejected",
      message: `Your leave request was rejected. Reason: ${reason || "No reason provided"}`,
      entityType: "leave_request",
      entityId: id,
      priority: "normal",
    });
    return this.requestDAL.findById(id, businessId);
  }

  async cancel(id: string, businessId: string, employeeUserId: string) {
    const record = await this.requestDAL.findById(id, businessId);
    if (!record) throw new Error("Leave request not found");
    if (record.employeeUserId !== employeeUserId) throw new Error("Forbidden");
    if (record.status === "approved" || record.status === "rejected") {
      throw new Error("Cannot cancel a closed request");
    }
    return this.requestDAL.update(id, businessId, { status: "cancelled", approvalStage: "cancelled" });
  }

  // ── Balance helpers ────────────────────────────────────────────────────────

  async getBalances(businessId: string, userId: string) {
    const year = new Date().getFullYear();
    return db.LeaveBalance.findAll({ where: { businessId, userId, year } });
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _assertPending(id: string, businessId: string, stage: string) {
    const record = await this.requestDAL.findById(id, businessId);
    if (!record) throw new Error("Leave request not found");
    if (record.status !== "pending") throw new Error("Request is not pending");
    if (record.approvalStage !== stage) {
      throw new Error(`This request is at the '${record.approvalStage}' stage, not '${stage}'`);
    }
    return record;
  }

  private _stageFields(stage: string, actorUserId: string, comment?: string) {
    const now = new Date();
    if (stage === "dept_head") return { deptHeadApprovedBy: actorUserId, deptHeadActionAt: now, deptHeadComment: comment };
    if (stage === "admin")     return { adminApprovedBy: actorUserId, adminActionAt: now, adminComment: comment };
    return {};
  }

  private _countWorkdays(start: string, end: string): number {
    const s = new Date(`${start}T00:00:00Z`);
    const e = new Date(`${end}T00:00:00Z`);
    let count = 0;
    const cur = new Date(s);
    while (cur <= e) {
      const day = cur.getUTCDay();
      if (day !== 0 && day !== 6) count++;
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
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
          entityType: "leave_request",
          entityId: payload.entityId,
          priority: "high",
        });
      }
    } catch (err) {
      console.error("[LeaveService] Failed to notify role users:", err);
    }
  }
}

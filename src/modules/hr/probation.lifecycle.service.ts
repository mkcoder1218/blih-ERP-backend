import { Op, type Transaction } from "sequelize";
import { db } from "../../models";
import { InternalNotifier } from "../notification/notification.service";
import { sendMail } from "../../services/mailer";
import { ProbationService } from "./probation.service";

export type ProbationDecision =
  | "CONFIRM_EMPLOYMENT"
  | "EXTEND_PROBATION"
  | "TERMINATE_EMPLOYMENT"
  | "REQUEST_MORE_INFORMATION";

interface ScoreInput {
  criterionId: string;
  score: number;
  comment?: string | null;
}

interface ReviewInput {
  recommendation: ProbationDecision;
  comments?: string | null;
  scores: ScoreInput[];
}

interface FinalDecisionInput {
  decision: Exclude<ProbationDecision, "REQUEST_MORE_INFORMATION">;
  comments?: string | null;
  extensionMonths?: number;
  newExpectedEndDate?: string;
}

function dateOnly(value: string | Date): string {
  const date = value instanceof Date ? new Date(value) : new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date value.");
  return date.toISOString().slice(0, 10);
}

function addMonths(value: string, months: number): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const maxDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, maxDay));
  return date.toISOString().slice(0, 10);
}

function assertScore(score: number): number {
  const value = Number(score);
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("Every criterion score must be between 0 and 100.");
  }
  return value;
}

function weightedScore(criteria: any[], field: "managerScore" | "hrScore" | "finalScore"): number {
  const total = criteria.reduce((sum, criterion) => {
    const score = Number(criterion[field]);
    const weight = Number(criterion.weight);
    return sum + (Number.isFinite(score) ? score : 0) * (Number.isFinite(weight) ? weight : 0) / 100;
  }, 0);
  return Number(total.toFixed(2));
}

function appendHistory(metadata: any, event: Record<string, unknown>) {
  const current = metadata && typeof metadata === "object" ? metadata : {};
  const history = Array.isArray(current.history) ? current.history : [];
  return { ...current, history: [...history, { ...event, at: new Date().toISOString() }] };
}

async function notifyUser(args: {
  businessId: string;
  recipient: any;
  actorUserId?: string;
  title: string;
  message: string;
  probationId: string;
  type: string;
}) {
  if (!args.recipient?.id) return;
  await InternalNotifier.send({
    businessId: args.businessId,
    recipientUserId: args.recipient.id,
    senderUserId: args.actorUserId,
    moduleKey: "hr",
    type: args.type,
    title: args.title,
    message: args.message,
    entityType: "EmployeeProbation",
    entityId: args.probationId,
    priority: "HIGH",
  });
  if (args.recipient.email) {
    await sendMail({
      to: args.recipient.email,
      subject: args.title,
      text: args.message,
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${args.title}</h2><p>${args.message}</p><p>Open Blih ERP to review the probation record.</p></div>`,
    });
  }
}

export class ProbationLifecycleService {
  private base = new ProbationService();

  async submitManagerReview(businessId: string, actorUserId: string, probationId: string, input: ReviewInput) {
    return db.sequelize.transaction(async (transaction: Transaction) => {
      const probation = await db.EmployeeProbation.findOne({
        where: { id: probationId, businessId },
        include: [{ model: db.EmployeeProbationCriterion, as: "criteria" }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!probation) throw new Error("Probation record not found.");
      if (String(probation.managerUserId) !== String(actorUserId)) {
        throw new Error("Only the assigned probation manager can submit this review.");
      }
      if (["CONFIRMED", "TERMINATED", "CANCELLED", "EXTENDED"].includes(probation.status)) {
        throw new Error("This probation lifecycle is already closed.");
      }
      const criteria: any[] = probation.criteria || [];
      if (!criteria.length) throw new Error("Probation criteria were not found.");
      const byId = new Map(input.scores.map((item) => [item.criterionId, item]));
      for (const criterion of criteria) {
        const score = byId.get(criterion.id);
        if (!score) throw new Error(`A score is required for ${criterion.name}.`);
        await criterion.update({
          managerScore: assertScore(score.score),
          managerComment: score.comment?.trim() || null,
        }, { transaction });
      }
      const refreshed = await db.EmployeeProbationCriterion.findAll({ where: { probationId, businessId }, transaction });
      const managerScore = weightedScore(refreshed, "managerScore");
      await probation.update({
        managerRecommendation: input.recommendation,
        managerReviewSubmittedAt: new Date(),
        status: "HR_REVIEW_PENDING",
        updatedByUserId: actorUserId,
        metadata: appendHistory(probation.metadata, {
          type: "MANAGER_REVIEW_SUBMITTED",
          actorUserId,
          score: managerScore,
          recommendation: input.recommendation,
          comments: input.comments?.trim() || null,
        }),
      }, { transaction });
      const detail = await this.base.getById(businessId, probationId, transaction);
      const recipients = [detail.finalApprover].filter(Boolean);
      for (const recipient of recipients) {
        await notifyUser({
          businessId,
          recipient,
          actorUserId,
          title: "Probation manager review submitted",
          message: `${detail.employee?.fullName || "An employee"}'s probation review is ready for HR review.`,
          probationId,
          type: "PROBATION_HR_REVIEW_REQUIRED",
        });
      }
      return detail;
    });
  }

  async submitHrReview(businessId: string, actorUserId: string, probationId: string, input: ReviewInput) {
    return db.sequelize.transaction(async (transaction: Transaction) => {
      const probation = await db.EmployeeProbation.findOne({
        where: { id: probationId, businessId },
        include: [{ model: db.EmployeeProbationCriterion, as: "criteria" }],
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!probation) throw new Error("Probation record not found.");
      if (!probation.managerReviewSubmittedAt) throw new Error("The manager review must be submitted first.");
      if (["CONFIRMED", "TERMINATED", "CANCELLED", "EXTENDED"].includes(probation.status)) {
        throw new Error("This probation lifecycle is already closed.");
      }
      const criteria: any[] = probation.criteria || [];
      const byId = new Map(input.scores.map((item) => [item.criterionId, item]));
      for (const criterion of criteria) {
        const score = byId.get(criterion.id);
        if (!score) throw new Error(`An HR score is required for ${criterion.name}.`);
        const hrScore = assertScore(score.score);
        const managerScore = Number(criterion.managerScore ?? hrScore);
        await criterion.update({
          hrScore,
          hrComment: score.comment?.trim() || null,
          finalScore: Number(((managerScore + hrScore) / 2).toFixed(2)),
        }, { transaction });
      }
      const refreshed = await db.EmployeeProbationCriterion.findAll({ where: { probationId, businessId }, transaction });
      const finalScore = weightedScore(refreshed, "finalScore");
      await probation.update({
        hrRecommendation: input.recommendation,
        hrReviewSubmittedAt: new Date(),
        finalScore,
        status: "FINAL_APPROVAL_PENDING",
        updatedByUserId: actorUserId,
        metadata: appendHistory(probation.metadata, {
          type: "HR_REVIEW_SUBMITTED",
          actorUserId,
          score: finalScore,
          recommendation: input.recommendation,
          comments: input.comments?.trim() || null,
        }),
      }, { transaction });
      return this.base.getById(businessId, probationId, transaction);
    });
  }

  async makeFinalDecision(businessId: string, actorUserId: string, probationId: string, input: FinalDecisionInput) {
    return db.sequelize.transaction(async (transaction: Transaction) => {
      const probation = await db.EmployeeProbation.findOne({
        where: { id: probationId, businessId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!probation) throw new Error("Probation record not found.");
      if (!probation.hrReviewSubmittedAt) throw new Error("The HR review must be submitted first.");
      if (probation.finalApproverUserId && String(probation.finalApproverUserId) !== String(actorUserId)) {
        throw new Error("Only the assigned final approver can make this decision.");
      }
      const now = new Date();
      const today = now.toISOString().slice(0, 10);
      let status = "CONFIRMED";
      let childProbationId: string | null = null;
      if (input.decision === "TERMINATE_EMPLOYMENT") status = "TERMINATED";
      if (input.decision === "EXTEND_PROBATION") status = "EXTENDED";
      await probation.update({
        finalDecision: input.decision,
        decisionApprovedAt: now,
        actualEndDate: today,
        status,
        updatedByUserId: actorUserId,
        metadata: appendHistory(probation.metadata, {
          type: "FINAL_DECISION_APPROVED",
          actorUserId,
          decision: input.decision,
          comments: input.comments?.trim() || null,
        }),
      }, { transaction });
      const employeeRecord = await db.EmployeeRecord.findOne({ where: { id: probation.employeeRecordId, businessId }, transaction });
      if (employeeRecord) {
        if (input.decision === "CONFIRM_EMPLOYMENT") {
          await employeeRecord.update({ probationCompletedAt: now, probationEndDate: now }, { transaction });
        } else if (input.decision === "TERMINATE_EMPLOYMENT") {
          await employeeRecord.update({ employmentStatus: "terminated", probationCompletedAt: now, probationEndDate: now }, { transaction });
        } else {
          const months = Number(input.extensionMonths || 0);
          if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error("Extension duration must be between 1 and 12 months.");
          const startDate = dateOnly(probation.expectedEndDate);
          const expectedEndDate = input.newExpectedEndDate ? dateOnly(input.newExpectedEndDate) : addMonths(startDate, months);
          const child = await db.EmployeeProbation.create({
            businessId,
            employeeRecordId: probation.employeeRecordId,
            employeeUserId: probation.employeeUserId,
            positionId: probation.positionId,
            departmentId: probation.departmentId,
            managerUserId: probation.managerUserId,
            finalApproverUserId: probation.finalApproverUserId,
            source: "PROBATION_EXTENSION",
            status: "ACTIVE",
            startDate,
            expectedEndDate,
            durationMonths: months,
            parentProbationId: probation.id,
            createdByUserId: actorUserId,
            updatedByUserId: actorUserId,
            notes: input.comments?.trim() || null,
            metadata: { history: [{ type: "PROBATION_EXTENSION_STARTED", actorUserId, at: now.toISOString() }] },
          }, { transaction });
          const originalCriteria = await db.EmployeeProbationCriterion.findAll({ where: { probationId, businessId }, transaction });
          await db.EmployeeProbationCriterion.bulkCreate(originalCriteria.map((criterion: any) => ({
            businessId,
            probationId: child.id,
            sourcePositionCompetencyId: criterion.sourcePositionCompetencyId,
            name: criterion.name,
            description: criterion.description,
            weight: criterion.weight,
            isRequired: criterion.isRequired,
            sortOrder: criterion.sortOrder,
          })), { transaction });
          childProbationId = child.id;
          if (employeeRecord) await employeeRecord.update({ probationEndDate: new Date(`${expectedEndDate}T00:00:00.000Z`), probationCompletedAt: null }, { transaction });
        }
      }
      const detail = await this.base.getById(businessId, probationId, transaction);
      await notifyUser({
        businessId,
        recipient: detail.employee,
        actorUserId,
        title: input.decision === "CONFIRM_EMPLOYMENT" ? "Employment confirmed" : input.decision === "EXTEND_PROBATION" ? "Probation extended" : "Probation decision completed",
        message: input.decision === "CONFIRM_EMPLOYMENT"
          ? "Your probation has been completed and your employment has been confirmed."
          : input.decision === "EXTEND_PROBATION"
            ? "Your probation period has been extended. Open Blih ERP for the updated dates."
            : "Your probation has ended with a termination decision. Please contact HR for details.",
        probationId,
        type: "PROBATION_FINAL_DECISION",
      });
      return { probation: detail, childProbationId };
    });
  }

  async acknowledge(businessId: string, actorUserId: string, probationId: string) {
    const probation = await db.EmployeeProbation.findOne({ where: { id: probationId, businessId, employeeUserId: actorUserId } });
    if (!probation) throw new Error("Probation record not found.");
    await probation.update({
      employeeAcknowledgedAt: new Date(),
      updatedByUserId: actorUserId,
      metadata: appendHistory(probation.metadata, { type: "EMPLOYEE_ACKNOWLEDGED", actorUserId }),
    });
    return this.base.getById(businessId, probationId);
  }

  async myProbation(businessId: string, actorUserId: string) {
    const probation = await db.EmployeeProbation.findOne({
      where: { businessId, employeeUserId: actorUserId, status: { [Op.notIn]: ["CANCELLED"] } },
      order: [["createdAt", "DESC"]],
    });
    if (!probation) return null;
    return this.base.getById(businessId, probation.id);
  }
}

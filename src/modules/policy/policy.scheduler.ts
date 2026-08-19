import { db } from "../../models";
import { PolicyAssignmentService } from "./policy.assignment.service";
import { InternalNotifier } from "../notification/notification.service";
import { computePolicyContentHash } from "./policy.sanitizer";
import { env } from "../../config/env";
import { Op } from "sequelize";

export class PolicyScheduler {
  private assignmentService = new PolicyAssignmentService();

  /**
   * Converts a string key into a 64-bit BigInt for PostgreSQL advisory locks.
   */
  static hashKeyToBigInt(key: string): string {
    let hash = 0n;
    for (let i = 0; i < key.length; i++) {
      hash = (hash * 31n + BigInt(key.charCodeAt(i))) & 0x7fffffffffffffffn;
    }
    return hash.toString();
  }

  /**
   * Helper to format calendar dates in a given IANA timezone.
   */
  private getCalendarDateString(date: Date, timeZone: string): string {
    try {
      const formatter = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return formatter.format(date); // YYYY-MM-DD
    } catch {
      return date.toISOString().slice(0, 10);
    }
  }

  /**
   * Computes exact difference in calendar days between two dates in a timezone.
   */
  private getCalendarDayDiff(targetDate: Date, referenceDate: Date, timeZone: string): number {
    const targetStr = this.getCalendarDateString(targetDate, timeZone);
    const refStr = this.getCalendarDateString(referenceDate, timeZone);

    const targetTime = new Date(`${targetStr}T00:00:00Z`).getTime();
    const refTime = new Date(`${refStr}T00:00:00Z`).getTime();

    return Math.round((targetTime - refTime) / 86400000);
  }

  /**
   * Safely logs persistent reminder delivery with unique database deduplication.
   * Failed notification deliveries remain retryable and do NOT block future delivery retries.
   */
  private async trySendAndLogReminder(payload: {
    businessId: string;
    jobKey: string;
    reminderType: string;
    reminderWindow: string;
    recipientUserId: string;
    resourceId: string;
    policyVersionId?: string | null;
    acceptanceId?: string | null;
    title: string;
    message: string;
    entityType: string;
    entityId: string;
  }): Promise<boolean> {
    const dedupKey = [
      payload.jobKey,
      payload.recipientUserId,
      payload.reminderType,
      payload.reminderWindow,
      payload.resourceId,
      payload.policyVersionId || "v0"
    ].join(":");

    const existingLog = await db.PolicyNotificationLog.findOne({
      where: { dedupKey }
    });

    if (existingLog && existingLog.status === "delivered") {
      return false; // Already delivered successfully
    }

    try {
      await InternalNotifier.send({
        businessId: payload.businessId,
        recipientUserId: payload.recipientUserId,
        moduleKey: "policy",
        type: payload.reminderType,
        title: payload.title,
        message: payload.message,
        entityType: payload.entityType,
        entityId: payload.entityId
      });

      if (existingLog) {
        await existingLog.update({
          status: "delivered",
          errorMessage: null,
          sentAt: new Date()
        });
      } else {
        await db.PolicyNotificationLog.create({
          businessId: payload.businessId,
          jobKey: payload.jobKey,
          reminderType: payload.reminderType,
          reminderWindow: payload.reminderWindow,
          recipientUserId: payload.recipientUserId,
          resourceId: payload.resourceId,
          policyVersionId: payload.policyVersionId || null,
          acceptanceId: payload.acceptanceId || null,
          status: "delivered",
          dedupKey,
          sentAt: new Date()
        });
      }
      return true;
    } catch (sendErr: any) {
      console.error(`[policy.send-reminders] Delivery failed for ${dedupKey}: ${sendErr.message}`);
      if (existingLog) {
        await existingLog.update({
          status: "failed",
          errorMessage: sendErr.message
        });
      } else {
        try {
          await db.PolicyNotificationLog.create({
            businessId: payload.businessId,
            jobKey: payload.jobKey,
            reminderType: payload.reminderType,
            reminderWindow: payload.reminderWindow,
            recipientUserId: payload.recipientUserId,
            resourceId: payload.resourceId,
            policyVersionId: payload.policyVersionId || null,
            acceptanceId: payload.acceptanceId || null,
            status: "failed",
            errorMessage: sendErr.message,
            dedupKey,
            sentAt: new Date()
          });
        } catch {}
      }
      return false;
    }
  }

  /**
   * Job 1: Process scheduled policies whose effectiveFrom date has arrived.
   */
  async processScheduledPolicies(batchSize = env.policyJobBatchSize): Promise<{
    processedCount: number;
    successCount: number;
    failureCount: number;
    skippedCount: number;
  }> {
    const now = new Date();
    const candidatePolicies = await db.Policy.findAll({
      where: {
        status: "scheduled",
        effectiveFrom: { [Op.lte]: now }
      },
      limit: batchSize,
      order: [["effectiveFrom", "ASC"]]
    });

    let processedCount = 0;
    let successCount = 0;
    let failureCount = 0;
    let skippedCount = 0;

    for (const candidate of candidatePolicies) {
      processedCount++;

      try {
        const publicationResult = await db.sequelize.transaction(async (transaction: any) => {
          // Row-level lock
          const policy = await db.Policy.findOne({
            where: { id: candidate.id, status: "scheduled" },
            lock: transaction.LOCK.UPDATE,
            transaction
          });

          if (!policy) {
            return { status: "skipped", reason: "Policy status changed or concurrency lock unavailable" };
          }

          // 1. Verify active business
          const business = await db.Business.findOne({
            where: { id: policy.businessId, status: "active" },
            transaction
          });
          if (!business) {
            return { status: "skipped", reason: "Business is disabled or non-active" };
          }

          // 2. Verify active Policy module
          const moduleRecord = await db.BusinessModule.findOne({
            where: { businessId: policy.businessId, moduleKey: "policy", isEnabled: true },
            transaction
          });
          if (!moduleRecord) {
            return { status: "skipped", reason: "Policy module is disabled for this business" };
          }

          // 3. Verify approval data
          if (!policy.approvedAt && !policy.approvedByUserId) {
            const attempts = ((policy.metadata && policy.metadata.autoPublishAttempts) || 0) + 1;
            await policy.update({
              metadata: {
                ...policy.metadata,
                autoPublishAttempts: attempts,
                autoPublishLastError: "Missing mandatory approval metadata"
              }
            }, { transaction });
            return { status: "failed", reason: "Missing approval metadata" };
          }

          // 4. Verify version snapshot and content hash
          const version = await db.PolicyVersion.findOne({
            where: { policyId: policy.id, version: policy.version, businessId: policy.businessId },
            transaction
          });

          if (!version) {
            return { status: "failed", reason: "Published policy version snapshot not found" };
          }

          const expectedHash = computePolicyContentHash({
            policyId: policy.id,
            version: version.version,
            title: version.title,
            contentHtml: version.contentHtml,
            effectiveFrom: version.effectiveFrom,
            effectiveUntil: version.effectiveUntil,
            requiresAcceptance: version.requiresAcceptance,
            requiresSignature: version.requiresSignature
          });

          if (version.contentHash !== expectedHash) {
            return { status: "failed", reason: "Policy version content hash mismatch" };
          }

          // 5. Fetch assignments & freeze snapshot
          const assignments = await db.PolicyAssignment.findAll({
            where: { policyId: policy.id, businessId: policy.businessId },
            transaction
          });

          const assignmentSnapshot = assignments.map((a: any) => a.toJSON());

          await version.update({
            assignmentSnapshot,
            statusAtCreation: "published"
          }, { transaction });

          await policy.update({
            status: "published",
            publishedAt: now,
            publishedByUserId: null, // SYSTEM publish -> set null to preserve FK integrity
            updatedById: null,
            metadata: {
              ...policy.metadata,
              autoPublishedByJob: true,
              autoPublishedAt: now.toISOString(),
              actorType: "SYSTEM",
              jobKey: "policy.publish-scheduled"
            }
          }, { transaction });

          // 6. Generate acceptance obligations in bounded 500-user chunks
          const obligationsGenerated = await this.assignmentService.generateAcceptanceObligations(
            policy.businessId,
            policy,
            version,
            assignments,
            transaction
          );

          // 7. System Audit log entry (actorUserId set to null for SYSTEM actor)
          await db.AuditLog.create({
            businessId: policy.businessId,
            actorUserId: null,
            entityType: "policy_document",
            entityId: policy.id,
            action: "AUTO_PUBLISH_POLICY",
            newState: {
              status: "published",
              version: policy.version,
              obligationsGenerated,
              actorType: "SYSTEM",
              jobKey: "policy.publish-scheduled"
            }
          }, { transaction });

          return {
            status: "success",
            policy,
            version,
            obligationsGenerated
          };
        });

        if (publicationResult.status === "success") {
          successCount++;

          // Dispatched AFTER transaction commit
          if (publicationResult.policy && publicationResult.policy.ownerUserId) {
            try {
              await InternalNotifier.send({
                businessId: publicationResult.policy.businessId,
                recipientUserId: publicationResult.policy.ownerUserId,
                moduleKey: "policy",
                type: "policy_auto_published",
                title: "Policy Published Automatically",
                message: `Scheduled policy "${publicationResult.policy.title}" is now published and active.`,
                entityType: "policy",
                entityId: publicationResult.policy.id
              });
            } catch (err: any) {
              console.error(`[policy.publish-scheduled] Notification error for policy ${publicationResult.policy.id}: ${err.message}`);
            }
          }
        } else if (publicationResult.status === "skipped") {
          skippedCount++;
        } else {
          failureCount++;
        }
      } catch (err: any) {
        failureCount++;
        console.error(`[policy.publish-scheduled] Error publishing policy ${candidate.id}: ${err.message}`);

        try {
          const attempts = ((candidate.metadata && candidate.metadata.autoPublishAttempts) || 0) + 1;
          const updates: any = {
            metadata: {
              ...candidate.metadata,
              autoPublishAttempts: attempts,
              autoPublishLastError: err.message
            }
          };
          if (attempts >= env.policyJobMaxRetries) {
            updates.metadata.autoPublishFailedAt = new Date().toISOString();
          }
          await candidate.update(updates);
        } catch {}
      }
    }

    return { processedCount, successCount, failureCount, skippedCount };
  }

  /**
   * Job 2: Mark pending/viewed acceptances past due date as overdue.
   */
  async processOverdueAcceptances(batchSize = env.policyJobBatchSize): Promise<{
    processedCount: number;
    updatedCount: number;
  }> {
    const now = new Date();

    const overdueAcceptances = await db.PolicyAcceptance.findAll({
      where: {
        status: { [Op.in]: ["pending", "viewed"] },
        dueAt: { [Op.lt]: now }
      },
      limit: batchSize
    });

    if (!overdueAcceptances || overdueAcceptances.length === 0) {
      return { processedCount: 0, updatedCount: 0 };
    }

    const ids = overdueAcceptances.map((a: any) => a.id);

    const [updatedCount] = await db.PolicyAcceptance.update({
      status: "overdue"
    }, {
      where: {
        id: { [Op.in]: ids },
        status: { [Op.in]: ["pending", "viewed"] }
      }
    });

    if (updatedCount > 0) {
      try {
        await db.AuditLog.create({
          businessId: overdueAcceptances[0].businessId,
          actorUserId: null,
          entityType: "policy_acceptance",
          entityId: overdueAcceptances[0].id,
          action: "MARK_POLICY_ACCEPTANCE_OVERDUE",
          newState: {
            updatedCount,
            actorType: "SYSTEM",
            jobKey: "policy.mark-overdue"
          }
        });
      } catch {}
    }

    return { processedCount: overdueAcceptances.length, updatedCount };
  }

  /**
   * Job 3: Process policy reminders for review, expiry, acceptance due, and scheduled policies.
   */
  async processPolicyReminders(
    fallbackTimezone = env.policyReminderTimezone,
    batchSize = env.policyJobBatchSize
  ): Promise<{
    totalRemindersEvaluated: number;
    remindersSent: number;
  }> {
    let totalRemindersEvaluated = 0;
    let remindersSent = 0;

    const getBusinessTimezone = async (businessId: string): Promise<string> => {
      try {
        const b = await db.Business.findOne({
          where: { id: businessId, status: "active" },
          attributes: ["id", "timezone", "status"]
        });
        return b && b.timezone ? b.timezone : fallbackTimezone;
      } catch {
        return fallbackTimezone;
      }
    };

    // Sub-routine 1: Policy Review Reminders (30d, 14d, 7d)
    try {
      const activePolicies = await db.Policy.findAll({
        where: {
          status: "published",
          reviewDueAt: { [Op.ne]: null }
        },
        limit: batchSize
      });

      const now = new Date();

      for (const policy of activePolicies) {
        totalRemindersEvaluated++;
        if (!policy.ownerUserId || !policy.reviewDueAt) continue;

        const tz = await getBusinessTimezone(policy.businessId);
        const dayDiff = this.getCalendarDayDiff(new Date(policy.reviewDueAt), now, tz);

        let windowLabel = "";
        if (dayDiff === 30) windowLabel = "30d";
        else if (dayDiff === 14) windowLabel = "14d";
        else if (dayDiff === 7) windowLabel = "7d";

        if (windowLabel) {
          const sent = await this.trySendAndLogReminder({
            businessId: policy.businessId,
            jobKey: "policy.send-reminders",
            reminderType: "policy_review_due",
            reminderWindow: windowLabel,
            recipientUserId: policy.ownerUserId,
            resourceId: policy.id,
            policyVersionId: `v${policy.version}`,
            title: `Policy Review Due (${windowLabel})`,
            message: `Policy "${policy.title}" is due for scheduled review on ${policy.reviewDueAt.toISOString().slice(0, 10)}.`,
            entityType: "policy",
            entityId: policy.id
          });
          if (sent) remindersSent++;
        }
      }
    } catch (err: any) {
      console.error(`[policy.send-reminders] Sub-routine 1 (review) error: ${err.message}`);
    }

    // Sub-routine 2: Policy Expiry Reminders (30d, 14d, 7d)
    try {
      const expiringPolicies = await db.Policy.findAll({
        where: {
          status: "published",
          effectiveUntil: { [Op.ne]: null }
        },
        limit: batchSize
      });

      const now = new Date();

      for (const policy of expiringPolicies) {
        totalRemindersEvaluated++;
        if (!policy.ownerUserId || !policy.effectiveUntil) continue;

        const tz = await getBusinessTimezone(policy.businessId);
        const dayDiff = this.getCalendarDayDiff(new Date(policy.effectiveUntil), now, tz);

        let windowLabel = "";
        if (dayDiff === 30) windowLabel = "30d";
        else if (dayDiff === 14) windowLabel = "14d";
        else if (dayDiff === 7) windowLabel = "7d";

        if (windowLabel) {
          const sent = await this.trySendAndLogReminder({
            businessId: policy.businessId,
            jobKey: "policy.send-reminders",
            reminderType: "policy_expiry_approaching",
            reminderWindow: windowLabel,
            recipientUserId: policy.ownerUserId,
            resourceId: policy.id,
            policyVersionId: `v${policy.version}`,
            title: `Policy Expiry Approaching (${windowLabel})`,
            message: `Policy "${policy.title}" will expire on ${policy.effectiveUntil.toISOString().slice(0, 10)}.`,
            entityType: "policy",
            entityId: policy.id
          });
          if (sent) remindersSent++;
        }
      }
    } catch (err: any) {
      console.error(`[policy.send-reminders] Sub-routine 2 (expiry) error: ${err.message}`);
    }

    // Sub-routine 3: Acceptance Due Reminders (7d, 3d, 1d) & Overdue Reminders
    try {
      const pendingAcceptances = await db.PolicyAcceptance.findAll({
        where: {
          status: { [Op.in]: ["pending", "viewed", "overdue"] },
          dueAt: { [Op.ne]: null }
        },
        include: [{ model: db.Policy, attributes: ["id", "title", "status", "version"] }],
        limit: batchSize
      });

      const now = new Date();

      for (const acceptance of pendingAcceptances) {
        totalRemindersEvaluated++;
        if (!acceptance.userId || !acceptance.dueAt || !acceptance.Policy) continue;
        if (acceptance.Policy.status !== "published") continue;

        const employee = await db.EmployeeRecord.findOne({
          where: { userId: acceptance.userId, businessId: acceptance.businessId, status: "active" }
        });
        if (!employee) continue;

        const tz = await getBusinessTimezone(acceptance.businessId);
        const dayDiff = this.getCalendarDayDiff(new Date(acceptance.dueAt), now, tz);

        let windowLabel = "";
        let reminderType = "acceptance_due_soon";

        if (acceptance.status === "overdue") {
          reminderType = "acceptance_overdue";
          windowLabel = "overdue";
        } else if (dayDiff === 7) windowLabel = "7d";
        else if (dayDiff === 3) windowLabel = "3d";
        else if (dayDiff === 1) windowLabel = "1d";

        if (windowLabel) {
          const sent = await this.trySendAndLogReminder({
            businessId: acceptance.businessId,
            jobKey: "policy.send-reminders",
            reminderType,
            reminderWindow: windowLabel,
            recipientUserId: acceptance.userId,
            resourceId: acceptance.policyId,
            policyVersionId: acceptance.policyVersionId,
            acceptanceId: acceptance.id,
            title: reminderType === "acceptance_overdue" ? "Policy Acceptance Overdue" : `Policy Acceptance Due (${windowLabel})`,
            message: `Acceptance is required for policy "${acceptance.Policy.title}". Due date: ${acceptance.dueAt.toISOString().slice(0, 10)}.`,
            entityType: "policy",
            entityId: acceptance.policyId
          });
          if (sent) remindersSent++;
        }
      }
    } catch (err: any) {
      console.error(`[policy.send-reminders] Sub-routine 3 (acceptance) error: ${err.message}`);
    }

    return { totalRemindersEvaluated, remindersSent };
  }
}

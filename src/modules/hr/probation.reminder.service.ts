import { Op } from "sequelize";
import { db } from "../../models";
import { InternalNotifier } from "../notification/notification.service";
import { sendMail } from "../../services/mailer";

const REMINDER_DAYS = [14, 7, 3, 0] as const;

function daysBetween(endDate: string, today: string) {
  return Math.ceil((new Date(`${endDate}T00:00:00.000Z`).getTime() - new Date(`${today}T00:00:00.000Z`).getTime()) / 86400000);
}

function reminderKey(days: number) {
  return days < 0 ? `overdue:${Math.abs(days)}` : `due:${days}`;
}

export class ProbationReminderService {
  async run() {
    const today = new Date().toISOString().slice(0, 10);
    const probations = await db.EmployeeProbation.findAll({
      where: {
        status: { [Op.in]: ["ACTIVE", "REVIEW_DUE", "MANAGER_REVIEW_PENDING", "HR_REVIEW_PENDING", "FINAL_APPROVAL_PENDING"] },
        expectedEndDate: { [Op.lte]: new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10) },
      },
      include: [
        { model: db.User, as: "employee", attributes: ["id", "fullName", "email"] },
        { model: db.User, as: "manager", attributes: ["id", "fullName", "email"] },
        { model: db.User, as: "finalApprover", attributes: ["id", "fullName", "email"], required: false },
      ],
    });
    let notificationsSent = 0;
    let emailsSent = 0;
    for (const probation of probations as any[]) {
      const days = daysBetween(String(probation.expectedEndDate), today);
      if (days > 14) continue;
      if (days >= 0 && !REMINDER_DAYS.includes(days as any)) continue;
      const key = reminderKey(days);
      const metadata = probation.metadata && typeof probation.metadata === "object" ? probation.metadata : {};
      const reminders = metadata.reminders && typeof metadata.reminders === "object" ? metadata.reminders : {};
      if (reminders[key]) continue;
      const title = days < 0 ? "Probation action overdue" : days === 0 ? "Probation ends today" : `Probation ends in ${days} days`;
      const message = `${probation.employee?.fullName || "An employee"}'s probation ${days < 0 ? `ended ${Math.abs(days)} day(s) ago` : days === 0 ? "ends today" : `ends in ${days} day(s)`}.`;
      const recipients = [probation.manager, probation.finalApprover].filter(Boolean);
      for (const recipient of recipients) {
        await InternalNotifier.send({
          businessId: probation.businessId,
          recipientUserId: recipient.id,
          moduleKey: "hr",
          type: "PROBATION_REMINDER",
          title,
          message,
          entityType: "EmployeeProbation",
          entityId: probation.id,
          priority: days <= 0 ? "URGENT" : "HIGH",
          metadata: { daysRemaining: days },
        });
        notificationsSent += 1;
        if (recipient.email) {
          await sendMail({
            to: recipient.email,
            subject: title,
            text: message,
            html: `<div style="font-family:Arial,sans-serif;line-height:1.6"><h2>${title}</h2><p>${message}</p><p>Please open Blih ERP and complete the required probation action.</p></div>`,
          });
          emailsSent += 1;
        }
      }
      const nextStatus = probation.status === "ACTIVE" && days <= 0 ? "MANAGER_REVIEW_PENDING" : probation.status;
      await probation.update({
        status: nextStatus,
        metadata: { ...metadata, reminders: { ...reminders, [key]: new Date().toISOString() } },
      });
    }
    return { scanned: probations.length, notificationsSent, emailsSent };
  }
}

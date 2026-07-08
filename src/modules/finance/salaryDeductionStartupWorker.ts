import { db } from "../../models";
import { SalaryDeductionService } from "./salaryDeduction.service";

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentMonthPeriod() {
  const now = new Date();
  return {
    start: dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export async function refreshSalaryDeductionSnapshotsOnStartup() {
  const jobName = "salary_deduction_snapshot_startup_refresh";
  const startedAt = new Date();
  const period = currentMonthPeriod();
  const log = await db.BackgroundJobLog.create({
    jobName,
    jobType: "finance",
    status: "running",
    attempts: 1,
    startedAt,
    metadata: { period },
  });

  const service = new SalaryDeductionService();
  let refreshedCount = 0;
  const failed: Array<{ payrollLinkId: string; employeeUserId: string; error: string }> = [];

  try {
    const links = await db.EmployeePayrollLink.findAll({
      where: { status: "active" },
      order: [["updatedAt", "DESC"]],
    });

    for (const link of links) {
      try {
        await service.syncForPayrollLink(link, {
          dateFrom: link.metadata?.deductionPeriodStart || period.start,
          dateTo: link.metadata?.deductionPeriodEnd || period.end,
        });
        refreshedCount += 1;
      } catch (error: any) {
        failed.push({
          payrollLinkId: String(link.id),
          employeeUserId: String(link.employeeUserId),
          error: error?.message || "Unknown refresh error",
        });
      }
    }

    await log.update({
      status: failed.length ? "failed" : "success",
      finishedAt: new Date(),
      errorMessage: failed.length ? `${failed.length} salary deduction snapshot(s) failed to refresh` : null,
      metadata: { period, refreshedCount, failed },
    });

    if (failed.length) {
      console.warn(`[${jobName}] refreshed ${refreshedCount}; ${failed.length} failed`);
    } else {
      console.log(`[${jobName}] refreshed ${refreshedCount} salary deduction snapshot(s)`);
    }
  } catch (error: any) {
    await log.update({
      status: "failed",
      finishedAt: new Date(),
      errorMessage: error?.message || "Salary deduction startup refresh failed",
      metadata: { period, refreshedCount, failed },
    });
    console.error(`[${jobName}] failed`, error);
  }
}

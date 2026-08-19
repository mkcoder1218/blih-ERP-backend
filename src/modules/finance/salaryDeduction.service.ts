import { Op } from "sequelize";
import { db } from "../../models";
import { SalaryDeductionRepository, type SalaryDeductionSnapshotInput } from "./salaryDeduction.repository";
import { AttendanceHrService } from "../attendanceHr/attendanceHr.service";

type PeriodRange = { start: string; end: string };

const SALARY_PAY_DAYS_DEFAULT = 30;

function dateOnly(value: Date) {
  return value.toISOString().slice(0, 10);
}

function currentMonthRange(): PeriodRange {
  const now = new Date();
  return {
    start: dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: dateOnly(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function todayYmd() {
  return dateOnly(new Date());
}

function money(value: any) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) / 100 : 0;
}

function daysInclusive(start: string, end: string) {
  const first = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  if (Number.isNaN(first.getTime()) || Number.isNaN(last.getTime()) || first > last) return 0;
  return Math.floor((last.getTime() - first.getTime()) / 86_400_000) + 1;
}

function laterDate(a: string, b: string) {
  return a > b ? a : b;
}

function earlierDate(a: string, b: string) {
  return a < b ? a : b;
}

function titleCase(value: string) {
  return value.split(/[_\s-]+/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function eachDate(start: string, end: string) {
  const dates: string[] = [];
  const cursor = new Date(`${start}T00:00:00.000Z`);
  const last = new Date(`${end}T00:00:00.000Z`);
  while (cursor <= last) {
    dates.push(dateOnly(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function requestDateOnly(value: any) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return dateOnly(date);
}

function normalizeRequestCategory(value: any) {
  return String(value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export class SalaryDeductionService {
  private repo = new SalaryDeductionRepository();
  private attendanceHr = new AttendanceHrService();

  private periodFromInput(input?: any): PeriodRange | null {
    const start = String(input?.dateFrom || input?.startDate || input?.start || "").slice(0, 10);
    const end = String(input?.dateTo || input?.endDate || input?.end || "").slice(0, 10);
    if (start && end) return { start, end };
    return null;
  }

  private periodFromLink(link: any, override?: PeriodRange | null): PeriodRange {
    if (override) return override;
    const periodStart = link?.metadata?.periodStart || link?.metadata?.payPeriodStart;
    const periodEnd = link?.metadata?.periodEnd || link?.metadata?.payPeriodEnd;
    if (periodStart && periodEnd) return { start: String(periodStart).slice(0, 10), end: String(periodEnd).slice(0, 10) };
    return currentMonthRange();
  }

  private salaryPayDays(salaryInfo: any = {}, link?: any) {
    const value = Number(
      salaryInfo.salaryPayDays ??
      salaryInfo.payrollDays ??
      salaryInfo.monthlyPayDays ??
      link?.metadata?.salaryPayDays ??
      link?.metadata?.payrollDays ??
      link?.metadata?.monthlyPayDays ??
      SALARY_PAY_DAYS_DEFAULT
    );
    return Number.isFinite(value) && value > 0 ? value : SALARY_PAY_DAYS_DEFAULT;
  }

  private async salaryContext(link: any) {
    if (link.__salaryDeductionContext) return link.__salaryDeductionContext;
    const employee = await db.EmployeeRecord.findOne({
      where: { businessId: link.businessId, userId: link.employeeUserId },
      attributes: ["salaryInfo", "hireDate", "createdAt"],
      include: [{ model: db.User, as: "user", attributes: ["createdAt"] }],
    });
    const salaryInfo = employee?.salaryInfo || {};
    const salaryInfoTargetNetSalary = money(
      salaryInfo.targetNetSalary ??
      salaryInfo.netSalary ??
      salaryInfo.targetNetPay ??
      salaryInfo.netPay
    );
    const targetNetSalary = money(
      link.metadata?.targetNetSalary ??
      salaryInfoTargetNetSalary
    );
    const salaryInfoInputMode = String(salaryInfo.salaryInputMode ?? salaryInfo.inputMode ?? "").toLowerCase();
    const salaryInfoIsNetMode = salaryInfoTargetNetSalary > 0 && salaryInfoInputMode !== "base";
    const salaryInputMode = salaryInfoIsNetMode
      ? (salaryInfo.salaryInputMode ?? salaryInfo.inputMode ?? "net")
      : (link.metadata?.salaryInputMode ?? salaryInfo.salaryInputMode ?? salaryInfo.inputMode);
    const normalizedSalaryInputMode = String(salaryInputMode || "").toLowerCase();
    const baseSalary = money(
      salaryInfo.baseSalary ??
      salaryInfo.monthlySalary ??
      salaryInfo.salary ??
      link.baseSalary
    );
    link.__salaryDeductionContext = {
      salaryInfo,
      targetNetSalary,
      salaryInputMode,
      accountCreatedDate: dateOnly(new Date(employee?.user?.createdAt || employee?.createdAt || employee?.hireDate || 0)),
      hireDate: employee?.hireDate ? dateOnly(new Date(employee.hireDate)) : null,
      salaryPayDays: this.salaryPayDays(salaryInfo, link),
      deductionBase: normalizedSalaryInputMode !== "base" && targetNetSalary > 0 ? targetNetSalary : baseSalary,
    };
    return link.__salaryDeductionContext;
  }

  private async dayRate(link: any) {
    const context = await this.salaryContext(link);
    return money(context.deductionBase / context.salaryPayDays);
  }

  private async paidDaysAlreadyCovered(link: any, effectiveStart: string, effectiveEnd: string) {
    const paidRecords = await db.PayrollRecord.findAll({
      where: {
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        status: { [Op.in]: ["paid"] },
        periodStart: { [Op.lte]: effectiveEnd },
        periodEnd: { [Op.gte]: effectiveStart },
      },
      attributes: ["periodStart", "periodEnd"],
    });
    return paidRecords.reduce((sum: number, record: any) => {
      const overlapStart = laterDate(String(record.periodStart).slice(0, 10), effectiveStart);
      const overlapEnd = earlierDate(String(record.periodEnd).slice(0, 10), effectiveEnd);
      return sum + daysInclusive(overlapStart, overlapEnd);
    }, 0);
  }

  private async approvedOvertimePay(link: any, period: PeriodRange) {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return 0;
    const expectedMinutesPerDay = Number(link?.metadata?.expectedMinutesPerDay || link?.metadata?.attendance?.expectedMinutesPerDay || 480);
    const minuteRate = dayRate / Math.max(expectedMinutesPerDay, 1);
    const requests = await db.OvertimeRequest.findAll({
      where: {
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        status: { [Op.in]: ["approved", "closed"] },
        overtimeDate: { [Op.between]: [period.start, period.end] },
      },
    });
    return money(requests.reduce((sum: number, request: any) => {
      const minutes = Number(request.approvedOvertimeMinutes || request.totalMinutes || request.expectedDurationMinutes || 0);
      return sum + Math.max(minutes, 0) * minuteRate;
    }, 0));
  }

  private async approvedLeaveUnits(link: any, period: PeriodRange) {
    const leaves = await db.LeaveRequest.findAll({
      where: {
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        status: "approved",
        startDate: { [Op.lte]: period.end },
        endDate: { [Op.gte]: period.start },
      },
    });
    const unitsByDate = new Map<string, number>();
    for (const leave of leaves) {
      const start = String(leave.startDate) > period.start ? String(leave.startDate) : period.start;
      const end = String(leave.endDate) < period.end ? String(leave.endDate) : period.end;
      const dates = eachDate(start, end);
      const requestedDays = Number((leave.requestedDays ?? leave.totalDays ?? dates.length) || 1);
      const perDayUnits = String(leave.durationType || "").toUpperCase() === "HALF_DAY"
        ? 0.5
        : Math.min(Math.max(requestedDays / Math.max(dates.length, 1), 0), 1);
      dates.forEach((date) => {
        unitsByDate.set(date, Math.min((unitsByDate.get(date) || 0) + perDayUnits, 1));
      });
    }
    return unitsByDate;
  }

  private async approvedWorkFromHomeUnits(link: any, period: PeriodRange) {
    const requests = await db.AttendanceRequest.findAll({
      where: {
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        requestType: "work_from_home",
        status: "approved",
        fromAt: { [Op.lte]: new Date(`${period.end}T23:59:59.999Z`) },
        toAt: { [Op.gte]: new Date(`${period.start}T00:00:00.000Z`) },
      },
      attributes: ["id", "fromAt", "toAt", "durationMinutes", "category"],
    });

    const unitsByDate = new Map<string, number>();
    for (const request of requests) {
      const start = laterDate(requestDateOnly(request.fromAt), period.start);
      const end = earlierDate(requestDateOnly(request.toAt), period.end);
      if (!start || !end || start > end) continue;

      const dates = eachDate(start, end);
      const normalizedCategory = normalizeRequestCategory(request.category);
      const durationMinutes = Number(request.durationMinutes || 0);
      const computedUnits = dates.length
        ? Math.min(Math.max(durationMinutes / (480 * dates.length), 0), 1)
        : 0;
      const perDayUnits = normalizedCategory === "partial_day"
        ? Math.min(Math.max(computedUnits || 0.5, 0), 0.5)
        : Math.min(Math.max(computedUnits || 1, 0), 1);

      dates.forEach((date) => {
        unitsByDate.set(date, Math.min((unitsByDate.get(date) || 0) + perDayUnits, 1));
      });
    }

    return unitsByDate;
  }

  private async attendanceDeductionInputs(link: any, period: PeriodRange, leaveUnits: Map<string, number>, wfhUnits: Map<string, number>): Promise<SalaryDeductionSnapshotInput[]> {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return [];
    const records = await db.AttendanceRecord.findAll({
      where: {
        businessId: link.businessId,
        userId: link.employeeUserId,
        date: { [Op.between]: [period.start, period.end] },
      },
    });
    const inputs: SalaryDeductionSnapshotInput[] = [];
    const today = todayYmd();
    for (const record of records) {
      const leaveUnit = leaveUnits.get(String(record.date)) || 0;
      const wfhUnit = wfhUnits.get(String(record.date)) || 0;
      const status = String(record.status || "").toLowerCase();
      const missingCheck = !record.checkInAt || !record.checkOutAt;
      let reasonType = "";
      let amount = 0;
      let description = "";
      if (["absent", "missed", "missed_day"].includes(status)) {
        reasonType = "missed_day";
        amount = dayRate * Math.max(1 - leaveUnit - wfhUnit, 0);
        description = `Missed working day on ${record.date}${leaveUnit || wfhUnit ? ` after ${leaveUnit} approved leave day(s) and ${wfhUnit} approved work-from-home day(s).` : "."}`;
      } else if (status === "half_day") {
        reasonType = "missed_day";
        amount = dayRate * Math.max(0.5 - leaveUnit - wfhUnit, 0);
        description = `Half-day attendance deduction on ${record.date}.`;
      } else if (status === "late" && leaveUnit <= 0 && wfhUnit < 1) {
        reasonType = "late_arrival";
        amount = dayRate / 4;
        description = `Late check-in recorded on ${record.date}.`;
      } else if (missingCheck && leaveUnit <= 0 && wfhUnit <= 0 && String(record.date) < today) {
        reasonType = "incomplete_attendance";
        amount = dayRate / 4;
        description = `Incomplete attendance record on ${record.date}.`;
      }
      if (amount > 0) {
        inputs.push({
          businessId: link.businessId,
          employeeUserId: link.employeeUserId,
          payrollLinkId: link.id,
          reasonType,
          sourceModule: "attendance",
          sourceTable: "hr_attendance_records",
          sourceRecordId: record.id,
          relatedDate: record.date,
          amount: money(amount),
          currency: link.currency || "ETB",
          description,
          metadata: { status: record.status, systemGenerated: true },
        });
      }
    }
    return inputs;
  }

  private async attendanceReportDeductionInputs(link: any, period: PeriodRange, leaveUnits: Map<string, number>, wfhUnits: Map<string, number>): Promise<SalaryDeductionSnapshotInput[]> {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return [];

    let report: any;
    try {
      report = await this.attendanceHr.report(link.businessId, {
        startDate: period.start,
        endDate: period.end,
        employeeId: link.employeeUserId,
        sortBy: "date",
        sortOrder: "asc",
      });
    } catch {
      return [];
    }

    const inputs: SalaryDeductionSnapshotInput[] = [];
    const today = todayYmd();
    for (const row of report.rows || []) {
      const leaveUnit = leaveUnits.get(String(row.date)) || 0;
      const wfhUnit = wfhUnits.get(String(row.date)) || 0;
      const status = String(row.currentStatus || row.status || "").toUpperCase();
      const workDayMode = String(row.workDayMode || "").toUpperCase();
      const expectedMinutes = Number(row.expectedMinutes || 0);
      const isPaidDayOff = status === "PAID_DAY_OFF" || workDayMode === "PAID_DAY_OFF" || expectedMinutes <= 0;
      if (isPaidDayOff) continue;
      const isMissed = ["MISSED", "NOT_STARTED", "ABSENT"].includes(status);
      const isCompletedDate = String(row.date) < today;
      const isIncomplete = isCompletedDate && (status === "INCOMPLETE" || status === "INCOMPLETE_PUNCH" || !row.checkInAtUtc || !row.checkOutAtUtc);
      if (isMissed) {
        const amount = money(dayRate * Math.max(1 - leaveUnit - wfhUnit, 0));
        if (amount <= 0) continue;
        inputs.push({
          businessId: link.businessId,
          employeeUserId: link.employeeUserId,
          payrollLinkId: link.id,
          reasonType: "missed_day",
          sourceModule: "attendance",
          sourceTable: "attendance_hr_report",
          sourceRecordId: null,
          relatedDate: row.date,
          amount,
          currency: link.currency || "ETB",
          description: `Missed working day on ${row.date}${leaveUnit || wfhUnit ? ` after ${leaveUnit} approved leave day(s) and ${wfhUnit} approved work-from-home day(s).` : "."}`,
          metadata: { currentStatus: row.currentStatus, approvedLeaveUnit: leaveUnit, approvedWorkFromHomeUnit: wfhUnit, systemGenerated: true },
        });
      } else if (isIncomplete && leaveUnit <= 0 && wfhUnit <= 0) {
        inputs.push({
          businessId: link.businessId,
          employeeUserId: link.employeeUserId,
          payrollLinkId: link.id,
          reasonType: "incomplete_attendance",
          sourceModule: "attendance",
          sourceTable: "attendance_hr_report",
          sourceRecordId: null,
          relatedDate: row.date,
          amount: money(dayRate / 4),
          currency: link.currency || "ETB",
          description: `Incomplete check-in/check-out record on ${row.date}.`,
          metadata: { currentStatus: row.currentStatus, systemGenerated: true },
        });
      }

      const penaltyMinutes = Number(row.penaltyMinutes || 0);
      const penaltyText = String(`${row.penaltyReason || ""} ${row.deductionLabel || ""}`).toLowerCase();
      const skipPenalty = isIncomplete || penaltyText.includes("lunch");
      if (penaltyMinutes > 0 && leaveUnit <= 0 && wfhUnit < 1 && !skipPenalty) {
        const expectedMinutes = Number(row.expectedMinutes || 480);
        const amount = money(dayRate * Math.min(penaltyMinutes / Math.max(expectedMinutes, 1), 1));
        inputs.push({
          businessId: link.businessId,
          employeeUserId: link.employeeUserId,
          payrollLinkId: link.id,
          reasonType: "attendance_penalty",
          sourceModule: "attendance",
          sourceTable: "attendance_hr_report",
          sourceRecordId: null,
          relatedDate: row.date,
          amount,
          currency: link.currency || "ETB",
          description: row.penaltyReason || `Attendance penalty of ${penaltyMinutes} minute(s) on ${row.date}.`,
          metadata: {
            currentStatus: row.currentStatus,
            penaltyMinutes,
            expectedMinutes,
            deductionLabel: row.deductionLabel,
            systemGenerated: true,
          },
        });
      }
    }
    return inputs.filter((item) => item.amount > 0);
  }

  private async lateExplanationDeductionInputs(link: any, period: PeriodRange, leaveUnits: Map<string, number>, wfhUnits: Map<string, number>): Promise<SalaryDeductionSnapshotInput[]> {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return [];
    const start = new Date(`${period.start}T00:00:00.000Z`);
    const end = new Date(`${period.end}T23:59:59.999Z`);
    const explanations = await db.AttendanceLateExplanation.findAll({
      where: { businessId: link.businessId, employeeId: link.employeeUserId },
      include: [
        {
          model: db.AttendanceEvent,
          as: "event",
          required: true,
          where: { timestampUtc: { [Op.between]: [start, end] } },
        },
        { model: db.AttendanceLateReason, as: "reason" },
      ],
    });
    return explanations.map((explanation: any) => {
      const eventDate = explanation.event?.timestampUtc ? dateOnly(new Date(explanation.event.timestampUtc)) : null;
      if (eventDate && (leaveUnits.get(eventDate) || 0) > 0) return null;
      if (eventDate && (wfhUnits.get(eventDate) || 0) >= 1) return null;
      const coveredMinutes = Number(explanation.reason?.coversMinutes || 0);
      const lateByMinutes = Number(explanation.lateByMinutes || 0);
      const chargeableMinutes = Math.max(lateByMinutes - coveredMinutes, 0);
      const amount = chargeableMinutes > 0 ? dayRate / 4 : 0;
      if (amount <= 0) return null;
      return {
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        payrollLinkId: link.id,
        reasonType: "late_arrival",
        sourceModule: "attendance",
        sourceTable: "attendance_late_explanations",
        sourceRecordId: explanation.id,
        relatedDate: eventDate,
        amount: money(amount),
        currency: link.currency || "ETB",
        description: `Late check-in by ${lateByMinutes} minute(s) on ${eventDate}. ${coveredMinutes ? `${coveredMinutes} minute(s) covered by reason policy.` : "No covered minutes were applied."}`,
        metadata: {
          lateByMinutes,
          coveredMinutes,
          chargeableMinutes,
          attendanceEventId: explanation.attendanceEventId,
          reason: explanation.reason?.name || explanation.customReason || null,
          systemGenerated: true,
        },
      } as SalaryDeductionSnapshotInput;
    }).filter((item): item is SalaryDeductionSnapshotInput => Boolean(item));
  }

  private async missedWorkingDayInputs(link: any, period: PeriodRange, leaveUnits: Map<string, number>, wfhUnits: Map<string, number>): Promise<SalaryDeductionSnapshotInput[]> {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return [];

    const employee = await db.EmployeeRecord.findOne({
      where: { businessId: link.businessId, userId: link.employeeUserId },
      attributes: ["id", "salaryInfo"],
    });
    const salaryInfo = employee?.salaryInfo || {};
    const workingDays = Number(salaryInfo.workingDaysInPeriod ?? link.metadata?.workingDaysInPeriod ?? 0);
    if (!Number.isFinite(workingDays) || workingDays <= 0) return [];
    const daysPaid = Number(salaryInfo.daysPaid ?? link.metadata?.daysPaid ?? 0);
    const approvedLeaveDays = Array.from(leaveUnits.values()).reduce((sum, value) => sum + value, 0);
    const approvedWorkFromHomeDays = Array.from(wfhUnits.values()).reduce((sum, value) => sum + value, 0);
    const missedDays = Math.max(workingDays - daysPaid - approvedLeaveDays - approvedWorkFromHomeDays, 0);
    if (!Number.isFinite(missedDays) || missedDays <= 0) return [];

    return [{
      businessId: link.businessId,
      employeeUserId: link.employeeUserId,
      payrollLinkId: link.id,
      reasonType: "missed_day",
      sourceModule: "attendance",
      sourceTable: "employee_salary_info",
      sourceRecordId: employee?.id || null,
      relatedDate: period.end,
      amount: money(dayRate * missedDays),
      currency: link.currency || "ETB",
      description: `${missedDays} missed working day(s): ${daysPaid} paid day(s), ${approvedLeaveDays} approved leave day(s), ${approvedWorkFromHomeDays} approved work-from-home day(s), out of ${workingDays}.`,
      metadata: { workingDaysInPeriod: workingDays, daysPaid, approvedLeaveDays, approvedWorkFromHomeDays, missedDays, systemGenerated: true },
    }];
  }

  private async dailyReasonDeductionInputs(link: any, period: PeriodRange, leaveUnits: Map<string, number>, wfhUnits: Map<string, number>): Promise<SalaryDeductionSnapshotInput[]> {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return [];
    const reasons = await db.AttendanceDailyReason.findAll({
      where: {
        businessId: link.businessId,
        employeeId: link.employeeUserId,
        dateYmd: { [Op.between]: [period.start, period.end] },
      },
    });
    return reasons
      .map((reason: any) => {
        const leaveUnit = leaveUnits.get(String(reason.dateYmd)) || 0;
        const wfhUnit = wfhUnits.get(String(reason.dateYmd)) || 0;
        const type = String(reason.reasonType || "").toLowerCase();
        const isEarly = type.includes("early");
        const isLate = type.includes("late");
        const isMissed = type.includes("missed") || type.includes("absent");
        const isIncomplete = type.includes("incomplete");
        const reasonType = isMissed ? "missed_day" : isEarly ? "early_checkout" : isLate ? "late_arrival" : isIncomplete ? "incomplete_attendance" : "";
        if (!reasonType) return null;
        const amount = isMissed ? dayRate * Math.max(1 - leaveUnit - wfhUnit, 0) : (leaveUnit > 0 || wfhUnit >= 1 ? 0 : dayRate / 4);
        if (amount <= 0) return null;
        return {
          businessId: link.businessId,
          employeeUserId: link.employeeUserId,
          payrollLinkId: link.id,
          reasonType,
          sourceModule: "attendance",
          sourceTable: "attendance_daily_reasons",
          sourceRecordId: reason.id,
          relatedDate: reason.dateYmd,
          amount: money(amount),
          currency: link.currency || "ETB",
          description: reason.comment || `${titleCase(reasonType)} deduction on ${reason.dateYmd}.`,
          metadata: { reasonType: reason.reasonType, attendanceEventId: reason.attendanceEventId, systemGenerated: true },
        } as SalaryDeductionSnapshotInput;
      })
      .filter((item): item is SalaryDeductionSnapshotInput => Boolean(item && item.amount > 0));
  }

  private async leaveDeductionInputs(link: any, period: PeriodRange): Promise<SalaryDeductionSnapshotInput[]> {
    const dayRate = await this.dayRate(link);
    if (dayRate <= 0) return [];
    const leaves = await db.LeaveRequest.findAll({
      where: {
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        status: "approved",
        startDate: { [Op.lte]: period.end },
        endDate: { [Op.gte]: period.start },
      },
      include: [{ model: db.LeaveTemplate, as: "template" }],
    });
    return leaves
      .filter((leave: any) => leave.template?.hasAmount === false || String(leave.leaveType || "").toLowerCase().includes("unpaid"))
      .map((leave: any) => ({
        businessId: link.businessId,
        employeeUserId: link.employeeUserId,
        payrollLinkId: link.id,
        reasonType: "leave",
        sourceModule: "leave",
        sourceTable: "leave_requests",
        sourceRecordId: leave.id,
        relatedDate: leave.startDate,
        amount: money(dayRate * Number(leave.requestedDays || leave.totalDays || 1)),
        currency: link.currency || "ETB",
        description: `Approved unpaid leave from ${leave.startDate} to ${leave.endDate}.`,
        metadata: { leaveType: leave.leaveType, requestedDays: Number(leave.requestedDays || leave.totalDays || 1), systemGenerated: true },
      }))
      .filter((item: SalaryDeductionSnapshotInput) => item.amount > 0);
  }

  async syncForPayrollLink(link: any, periodInput?: any) {
    const period = this.periodFromLink(link, this.periodFromInput(periodInput));
    const leaveUnits = await this.approvedLeaveUnits(link, period);
    const wfhUnits = await this.approvedWorkFromHomeUnits(link, period);
    await this.repo.retireSystemGeneratedForPeriod(link.businessId, link.id, period);
    const inputs = [
      ...(await this.attendanceReportDeductionInputs(link, period, leaveUnits, wfhUnits)),
      ...(await this.attendanceDeductionInputs(link, period, leaveUnits, wfhUnits)),
      ...(await this.missedWorkingDayInputs(link, period, leaveUnits, wfhUnits)),
      ...(await this.dailyReasonDeductionInputs(link, period, leaveUnits, wfhUnits)),
      ...(await this.lateExplanationDeductionInputs(link, period, leaveUnits, wfhUnits)),
      ...(await this.leaveDeductionInputs(link, period)),
    ];
    for (const input of inputs) await this.repo.upsertSnapshot(input);
    return this.recalculatePayrollLink(link.businessId, link.id, period);
  }

  async recalculatePayrollLink(businessId: string, payrollLinkId: string, periodInput?: any) {
    const link = await db.EmployeePayrollLink.findOne({ where: { businessId, id: payrollLinkId } });
    if (!link) throw new Error("Salary record not found");
    const period = this.periodFromLink(link, this.periodFromInput(periodInput));
    const deductions = await this.repo.listActiveForPayrollLinkIds(businessId, [payrollLinkId], period);
    const salaryImpactingDeductions = deductions.filter((item: any) => item.sourceModule !== "payroll");
    const deductionTotal = money(salaryImpactingDeductions.reduce((sum: number, item: any) => sum + money(item.amount), 0));
    const reconstructedRegularGrossPay = money(
      money(link.baseSalary) +
      money(link.housingAllowance) +
      money(link.transportAllowance) +
      money(link.mealAllowance) +
      money(link.otherAllowance) +
      money(link.metadata?.tax?.allowanceBreakdown?.perDiem?.amount) +
      money(link.metadata?.tax?.allowanceBreakdown?.medical?.amount) +
      money(link.metadata?.tax?.allowanceBreakdown?.telecom?.amount)
    );
    const regularGrossPay = money(link.grossPay) > 0
      ? money(link.grossPay)
      : reconstructedRegularGrossPay;
    const approvedOvertimePay = await this.approvedOvertimePay(link, period);
    const grossPayForNet = regularGrossPay > 0 ? regularGrossPay : money(link.grossPay);
    const payrollDeductionTotal = money(
      money(link.taxDeduction) +
      money(link.pensionDeduction) +
      money(link.healthDeduction) +
      money(link.loanDeduction) +
      money(link.otherDeduction)
    );
    const salaryContext = await this.salaryContext(link);
    const targetNetSalary = salaryContext.targetNetSalary;
    const salaryInputMode = salaryContext.salaryInputMode;
    const normalizedSalaryInputMode = String(salaryInputMode || "").toLowerCase();
    const isNetSalaryMode = normalizedSalaryInputMode !== "base" && targetNetSalary > 0;
    const accountStartDate = salaryContext.accountCreatedDate && salaryContext.accountCreatedDate !== "1970-01-01"
      ? salaryContext.accountCreatedDate
      : period.start;
    const effectiveStart = laterDate(period.start, accountStartDate);
    const effectiveEnd = period.end;
    const periodPayDays = Math.min(daysInclusive(effectiveStart, effectiveEnd), salaryContext.salaryPayDays);
    const paidDays = periodPayDays > 0 ? Math.min(await this.paidDaysAlreadyCovered(link, effectiveStart, effectiveEnd), periodPayDays) : 0;
    const payableDays = Math.max(periodPayDays - paidDays, 0);
    const payRatio = salaryContext.salaryPayDays > 0 ? payableDays / salaryContext.salaryPayDays : 1;
    const monthlyGrossForNet = grossPayForNet + approvedOvertimePay;
    const monthlyPayrollNetPay = isNetSalaryMode
      ? money(targetNetSalary + approvedOvertimePay)
      : money(Math.max(monthlyGrossForNet - payrollDeductionTotal, 0));
    const payrollNetPay = money(monthlyPayrollNetPay * payRatio);
    const payableGrossPay = money(monthlyGrossForNet * payRatio);
    const payablePayrollDeductionTotal = money(payrollDeductionTotal * payRatio);
    const netPay = money(Math.max(payrollNetPay - deductionTotal, 0));
    await link.update({
      totalDeductions: money(payablePayrollDeductionTotal + deductionTotal),
      netPay,
      metadata: {
        ...(link.metadata || {}),
        deductionTotal,
        attendanceLeaveDeductionTotal: deductionTotal,
        payrollDeductionTotal: payablePayrollDeductionTotal,
        monthlyPayrollDeductionTotal: payrollDeductionTotal,
        regularGrossPay,
        approvedOvertimePay,
        payableGrossPay,
        monthlyGrossPay: monthlyGrossForNet,
        periodPayDays,
        paidDaysAlreadyCovered: paidDays,
        payableDays,
        salaryPayDays: salaryContext.salaryPayDays,
        salaryPayRatio: payRatio,
        salaryEffectiveStart: effectiveStart,
        salaryEffectiveEnd: effectiveEnd,
        accountCreatedDate: salaryContext.accountCreatedDate || null,
        targetNetSalary: targetNetSalary || null,
        salaryInputMode: salaryInputMode || null,
        monthlyPayrollNetPayBeforeAttendanceLeaveDeductions: monthlyPayrollNetPay,
        payrollNetPayBeforeAttendanceLeaveDeductions: payrollNetPay,
        deductionPeriodStart: period.start,
        deductionPeriodEnd: period.end,
        deductionSnapshotUpdatedAt: new Date().toISOString(),
      },
    });
    return { link, deductions: salaryImpactingDeductions, deductionTotal, netPay };
  }

  async listForSalary(businessId: string, payrollLinkId: string, periodInput?: any) {
    const link = await db.EmployeePayrollLink.findOne({ where: { businessId, id: payrollLinkId } });
    if (!link) throw new Error("Salary record not found");
    const period = this.periodFromLink(link, this.periodFromInput(periodInput));
    await this.syncForPayrollLink(link, period);
    const deductions = await this.repo.listForPayrollLink(businessId, payrollLinkId, period);
    return this.formatSummary(deductions);
  }

  async removeDeduction(businessId: string, deductionId: string, removedByUserId: string, periodInput?: any) {
    const deduction = await this.repo.findActiveById(businessId, deductionId);
    if (!deduction) throw new Error("Deduction reason not found");
    await this.repo.markRemoved(deduction, removedByUserId);
    const recalculated = deduction.payrollLinkId
      ? await this.recalculatePayrollLink(businessId, deduction.payrollLinkId, periodInput)
      : { deductionTotal: 0, netPay: 0 };
    return {
      removed: deduction,
      deductionTotal: recalculated.deductionTotal,
      netPay: recalculated.netPay,
    };
  }

  formatSummary(deductions: any[]) {
    const rows = deductions.filter((item) => item.sourceModule !== "payroll").map((item) => ({
      id: item.id,
      employeeUserId: item.employeeUserId,
      payrollLinkId: item.payrollLinkId,
      payrollRecordId: item.payrollRecordId,
      reasonType: item.reasonType,
      reasonLabel: titleCase(item.reasonType),
      sourceModule: item.sourceModule,
      sourceTable: item.sourceTable,
      sourceRecordId: item.sourceRecordId,
      relatedDate: item.relatedDate,
      amount: money(item.amount),
      currency: item.currency,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }));
    const activeRows = rows.filter((item) => item.status === "active");
    return {
      total: money(activeRows.reduce((sum, item) => sum + item.amount, 0)),
      count: activeRows.length,
      rows,
      groups: activeRows.reduce((acc: Record<string, any>, item) => {
        const key = item.reasonType;
        acc[key] ||= { reasonType: key, label: item.reasonLabel, total: 0, rows: [] };
        acc[key].total = money(acc[key].total + item.amount);
        acc[key].rows.push(item);
        return acc;
      }, {}),
    };
  }
}

import { ACTIVE_EMPLOYMENT_STATUS } from "../constants/employee.constants";
import { db } from "../models";
import { Op } from "sequelize";
import type { WeekendWorkMode } from "../types/attendance";

export type AttendanceRosterEmployeeDay = {
  dateYmd: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string | null;
  department: { id: string; name: string } | null;
  assignedStartTime: "08:00" | "08:30" | "09:00";
  employmentCategory: "Managerial" | "Non-Managerial" | null;
  scheduledWorkDays: number[];
  employeeRecord: any;
};

const DEFAULT_WORK_DAYS = [1, 2, 3, 4, 5];
const VALID_START_TIMES = new Set(["08:00", "08:30", "09:00"]);
const VALID_CATEGORIES = new Set(["Managerial", "Non-Managerial"]);

function normalizeStartTime(value: unknown): "08:00" | "08:30" | "09:00" {
  const normalized = String(value || "09:00").trim();
  return (VALID_START_TIMES.has(normalized) ? normalized : "09:00") as "08:00" | "08:30" | "09:00";
}

function normalizeEmploymentCategory(value: unknown): "Managerial" | "Non-Managerial" | null {
  const normalized = String(value || "").trim();
  return VALID_CATEGORIES.has(normalized) ? (normalized as "Managerial" | "Non-Managerial") : null;
}

function normalizeWorkDays(value: unknown): number[] {
  const raw = Array.isArray(value) ? value : DEFAULT_WORK_DAYS;
  const days = Array.from(
    new Set(
      raw
        .map((day) => Number(day))
        .filter((day) => Number.isInteger(day) && day >= 1 && day <= 7)
    )
  ).sort((a, b) => a - b);
  return days.length ? days : DEFAULT_WORK_DAYS;
}

function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cur = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  while (cur.getTime() <= end.getTime()) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function isoWeekday(dateYmd: string): number {
  const day = new Date(`${dateYmd}T00:00:00.000Z`).getUTCDay();
  return day === 0 ? 7 : day;
}

function ymd(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const raw = String(value);
  return raw.length >= 10 ? raw.slice(0, 10) : null;
}

function weekendModeForIsoDay(isoDay: number, settings: any): WeekendWorkMode | null {
  if (isoDay === 6) return (settings?.saturdayWorkMode || "PAID_DAY_OFF") as WeekendWorkMode;
  if (isoDay === 7) return (settings?.sundayWorkMode || "PAID_DAY_OFF") as WeekendWorkMode;
  return null;
}

function shouldIncludeRosterDate(dateYmd: string, scheduledWorkDays: number[], settings: any) {
  const isoDay = isoWeekday(dateYmd);
  const weekendMode = weekendModeForIsoDay(isoDay, settings);
  if (weekendMode) return true;
  return scheduledWorkDays.includes(isoDay);
}

export class AttendanceRosterResolver {
  async resolveExpectedEmployees(
    businessId: string,
    opts: {
      startDate: string;
      endDate: string;
      departmentId?: string | null;
      employeeId?: string | null;
    }
  ): Promise<AttendanceRosterEmployeeDay[]> {
    const employeeWhere: any = {
      businessId,
      employmentStatus: ACTIVE_EMPLOYMENT_STATUS,
    };
    if (opts.departmentId) employeeWhere.departmentId = opts.departmentId;
    if (opts.employeeId) employeeWhere.userId = opts.employeeId;

    const exemptUserIds = db.UserExemption?.findAll
      ? (await db.UserExemption.findAll({
          where: { businessId, status: "APPROVED" },
          attributes: ["userId"],
        })).map((row: any) => row.userId)
      : [];
    if (opts.employeeId && exemptUserIds.includes(opts.employeeId)) return [];
    if (exemptUserIds.length) {
      employeeWhere.userId = opts.employeeId || { [Op.notIn]: exemptUserIds };
    }

    const [employees, attendanceSettings] = await Promise.all([
      db.EmployeeRecord.findAll({
      where: employeeWhere,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email", "status"], where: { status: "active" }, required: true },
        { model: db.Department, as: "department", attributes: ["id", "name"] },
      ],
      }),
      db.BusinessAttendanceSettings.findOne({ where: { businessId } }),
    ]);

    const rows: AttendanceRosterEmployeeDay[] = [];
    const dates = enumerateDates(opts.startDate, opts.endDate);

    for (const employee of employees) {
      const scheduledWorkDays = normalizeWorkDays((employee as any).scheduledWorkDays);
      const assignedStartTime = normalizeStartTime((employee as any).assignedStartTime);
      const employmentCategory = normalizeEmploymentCategory((employee as any).employmentCategory);
      const user = (employee as any).user;
      const department = (employee as any).department
        ? { id: (employee as any).department.id, name: (employee as any).department.name }
        : null;
      const effectiveStartDate = ymd((employee as any).hireDate) || ymd((employee as any).contractStartDate);
      const effectiveEndDate = ymd((employee as any).contractEndDate);

      for (const dateYmd of dates) {
        if (effectiveStartDate && dateYmd < effectiveStartDate) continue;
        if (effectiveEndDate && dateYmd > effectiveEndDate) continue;
        if (!shouldIncludeRosterDate(dateYmd, scheduledWorkDays, attendanceSettings)) continue;
        rows.push({
          dateYmd,
          employeeId: user.id,
          employeeName: user.fullName,
          employeeEmail: user.email || null,
          department,
          assignedStartTime,
          employmentCategory,
          scheduledWorkDays,
          employeeRecord: employee,
        });
      }
    }

    return rows;
  }

  async resolveExpectedEmployeeIds(businessId: string, opts: { startDate: string; endDate: string; departmentId?: string | null; employeeId?: string | null }) {
    const rows = await this.resolveExpectedEmployees(businessId, opts);
    return Array.from(new Set(rows.map((row) => row.employeeId)));
  }
}

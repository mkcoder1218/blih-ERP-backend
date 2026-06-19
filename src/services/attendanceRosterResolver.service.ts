import { ACTIVE_EMPLOYMENT_STATUS } from "../constants/employee.constants";
import { db } from "../models";

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

    const employees = await db.EmployeeRecord.findAll({
      where: employeeWhere,
      include: [
        { model: db.User, as: "user", attributes: ["id", "fullName", "email", "status"], where: { status: "active" }, required: true },
        { model: db.Department, as: "department", attributes: ["id", "name"] },
      ],
    });

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

      for (const dateYmd of dates) {
        if (!scheduledWorkDays.includes(isoWeekday(dateYmd))) continue;
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

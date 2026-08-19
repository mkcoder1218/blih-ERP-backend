import { ACTIVE_EMPLOYMENT_STATUS } from "../constants/employee.constants";
import { db } from "../models";
import { Op } from "sequelize";
import type { WeekendWorkMode } from "../types/attendance";
import { businessDateEndUtc, businessDateStartUtc } from "../utils/timezone";

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

function localDateKey(value: unknown, timeZone: string): string | null {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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
    const attendanceSettings = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    const timeZone = attendanceSettings?.timezone || "UTC";
    const dates = enumerateDates(opts.startDate, opts.endDate);

    // Actual punches are audit data. They must remain visible to HR even when
    // the employee's roster metadata is incomplete, inactive, outside the
    // configured schedule, or not yet represented by an EmployeeRecord.
    const eventWhere: any = {
      businessId,
      timestampUtc: {
        [Op.gte]: businessDateStartUtc(opts.startDate, timeZone),
        [Op.lt]: businessDateEndUtc(opts.endDate, timeZone),
      },
    };
    if (opts.employeeId) eventWhere.employeeId = opts.employeeId;

    const attendanceEvents = await db.AttendanceEvent.findAll({
      where: eventWhere,
      attributes: ["employeeId", "timestampUtc"],
    });

    const actualAttendanceKeys = new Set<string>();
    const actualEmployeeIds = new Set<string>();
    for (const event of attendanceEvents as any[]) {
      const employeeId = String(event.employeeId || "");
      const dateYmd = localDateKey(event.timestampUtc, timeZone);
      if (!employeeId || !dateYmd) continue;
      actualEmployeeIds.add(employeeId);
      actualAttendanceKeys.add(`${employeeId}:${dateYmd}`);
    }

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
        })).map((row: any) => String(row.userId))
      : [];
    const exemptUserIdSet = new Set<string>(exemptUserIds);

    const employees = await db.EmployeeRecord.findAll({
      where: employeeWhere,
      include: [
        {
          model: db.User,
          as: "user",
          attributes: ["id", "fullName", "email", "status"],
          where: { status: "active" },
          required: true,
        },
        { model: db.Department, as: "department", attributes: ["id", "name"] },
      ],
    });

    const rows: AttendanceRosterEmployeeDay[] = [];
    const rowKeys = new Set<string>();

    // First build the normal expected roster. Existing absence and scheduling
    // behavior remains unchanged.
    for (const employee of employees as any[]) {
      const user = employee.user;
      if (!user || exemptUserIdSet.has(String(user.id))) continue;

      const scheduledWorkDays = normalizeWorkDays(employee.scheduledWorkDays);
      const assignedStartTime = normalizeStartTime(employee.assignedStartTime);
      const employmentCategory = normalizeEmploymentCategory(employee.employmentCategory);
      const department = employee.department
        ? { id: employee.department.id, name: employee.department.name }
        : null;
      const effectiveStartDate = ymd(employee.hireDate) || ymd(employee.contractStartDate);
      const effectiveEndDate = ymd(employee.contractEndDate);

      for (const dateYmd of dates) {
        if (effectiveStartDate && dateYmd < effectiveStartDate) continue;
        if (effectiveEndDate && dateYmd > effectiveEndDate) continue;
        if (!shouldIncludeRosterDate(dateYmd, scheduledWorkDays, attendanceSettings)) continue;

        const key = `${user.id}:${dateYmd}`;
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
        rowKeys.add(key);
      }
    }

    // Then union in everyone who actually punched during the requested range.
    // This prevents real attendance events from disappearing from HR simply
    // because the employee record/profile lifecycle is incomplete or their
    // scheduled day metadata differs from the day they actually worked.
    const participantIds = Array.from(actualEmployeeIds);
    if (participantIds.length) {
      const [participantUsers, participantEmployeeRecords, participantProfiles] = await Promise.all([
        db.User.findAll({
          where: { businessId, id: { [Op.in]: participantIds } },
          attributes: ["id", "fullName", "email", "status"],
        }),
        db.EmployeeRecord.findAll({
          where: { businessId, userId: { [Op.in]: participantIds } },
          include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
        }),
        db.BusinessUserProfile.findAll({
          where: { businessId, userId: { [Op.in]: participantIds } },
          include: [{ model: db.Department, as: "department", attributes: ["id", "name"] }],
        }),
      ]);

      const employeeRecordByUserId = new Map<string, any>(
        (participantEmployeeRecords as any[]).map((record: any) => [String(record.userId), record])
      );
      const profileByUserId = new Map<string, any>(
        (participantProfiles as any[]).map((profile: any) => [String(profile.userId), profile])
      );

      for (const user of participantUsers as any[]) {
        const userId = String(user.id);
        const employeeRecord = employeeRecordByUserId.get(userId) || null;
        const profile = profileByUserId.get(userId) || null;
        const departmentModel = employeeRecord?.department || profile?.department || null;
        const department = departmentModel
          ? { id: departmentModel.id, name: departmentModel.name }
          : null;

        if (opts.departmentId && department?.id !== opts.departmentId) continue;

        const profileSettings = profile?.settings && typeof profile.settings === "object" ? profile.settings : {};
        const scheduledWorkDays = normalizeWorkDays(
          employeeRecord?.scheduledWorkDays ?? profileSettings.scheduledWorkDays
        );
        const assignedStartTime = normalizeStartTime(
          employeeRecord?.assignedStartTime ?? profileSettings.assignedStartTime
        );
        const employmentCategory = normalizeEmploymentCategory(
          employeeRecord?.employmentCategory ?? profileSettings.employmentCategory
        );

        const fallbackEmployeeRecord = employeeRecord || {
          businessId,
          userId,
          departmentId: profile?.departmentId || null,
          employmentType: profile?.employmentType || null,
          employmentStatus: profile?.status || null,
          assignedStartTime,
          employmentCategory,
          scheduledWorkDays,
          hireDate: profile?.joinedAt || null,
          contractStartDate: null,
          contractEndDate: null,
        };

        for (const dateYmd of dates) {
          const key = `${userId}:${dateYmd}`;
          if (!actualAttendanceKeys.has(key) || rowKeys.has(key)) continue;

          rows.push({
            dateYmd,
            employeeId: userId,
            employeeName: user.fullName,
            employeeEmail: user.email || profile?.workEmail || null,
            department,
            assignedStartTime,
            employmentCategory,
            scheduledWorkDays,
            employeeRecord: fallbackEmployeeRecord,
          });
          rowKeys.add(key);
        }
      }
    }

    return rows;
  }

  async resolveExpectedEmployeeIds(
    businessId: string,
    opts: {
      startDate: string;
      endDate: string;
      departmentId?: string | null;
      employeeId?: string | null;
    }
  ) {
    const rows = await this.resolveExpectedEmployees(businessId, opts);
    return Array.from(new Set(rows.map((row) => row.employeeId)));
  }
}

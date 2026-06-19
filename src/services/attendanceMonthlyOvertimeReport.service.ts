import { AttendanceDailyReportService } from "./attendanceDailyReport.service";

export type AttendanceMonthlyOvertimeReportRow = {
  Month: string;
  EmployeeId: string;
  EmployeeName: string;
  Department: string | null;
  TotalHoursWorked: number;
  RegularHours: number;
  ApprovedOvertimeHours: number;
};

export type AttendanceMonthlyOvertimeReportOptions = {
  month: string;
  departmentId?: string | null;
  employeeId?: string | null;
  audience?: "hr" | "public";
};

function monthBounds(month: string) {
  const startDate = `${month}-01`;
  const end = new Date(`${startDate}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(0);
  return { startDate, endDate: end.toISOString().slice(0, 10) };
}

export class AttendanceMonthlyOvertimeReportService {
  constructor(private readonly dailyReportService = new AttendanceDailyReportService()) {}

  async generate(businessId: string, opts: AttendanceMonthlyOvertimeReportOptions): Promise<AttendanceMonthlyOvertimeReportRow[]> {
    const { startDate, endDate } = monthBounds(opts.month);
    const dailyRows = await this.dailyReportService.generate(businessId, {
      startDate,
      endDate,
      departmentId: opts.departmentId,
      employeeId: opts.employeeId,
      audience: opts.audience || "hr",
    });

    const byEmployee = new Map<string, AttendanceMonthlyOvertimeReportRow>();
    for (const daily of dailyRows) {
      const row = byEmployee.get(daily.EmployeeId) || {
        Month: opts.month,
        EmployeeId: daily.EmployeeId,
        EmployeeName: daily.EmployeeName,
        Department: daily.Department,
        TotalHoursWorked: 0,
        RegularHours: 0,
        ApprovedOvertimeHours: 0,
      };
      row.TotalHoursWorked += Number(daily.TotalHoursWorked || daily.NetHoursWorked || 0);
      row.RegularHours += Number(daily.RegularHoursWorked || 0);
      row.ApprovedOvertimeHours += Number(daily.ApprovedOvertimeHours || 0);
      row.TotalHoursWorked = Math.round(row.TotalHoursWorked * 100) / 100;
      row.RegularHours = Math.round(row.RegularHours * 100) / 100;
      row.ApprovedOvertimeHours = Math.round(row.ApprovedOvertimeHours * 100) / 100;
      byEmployee.set(daily.EmployeeId, row);
    }

    return Array.from(byEmployee.values()).sort((a, b) => a.EmployeeName.localeCompare(b.EmployeeName));
  }
}

export type BusinessAttendanceSettings = {
  timezone: string;
  expectedDailyMinutes: number;
  defaultStartTime: string;
  defaultEndTime?: string;
  lateGracePeriodMinutes: number;
  lateNoReasonPenaltyGraceMinutes?: number;
  lunchBreakEnabled?: boolean;
  lunchMode?: "FIXED" | "FLEXIBLE";
  fixedLunchStartTime?: string | null;
  fixedLunchEndTime?: string | null;
  allowMultipleLunchBreaks?: boolean;
  saturdayWorkMode?: WeekendWorkMode | null;
  sundayWorkMode?: WeekendWorkMode | null;
};

export type WeekendWorkMode = "PAID_DAY_OFF" | "HALF_WORKING_DAY" | "FULL_WORKING_DAY";

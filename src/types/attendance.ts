export type BusinessAttendanceSettings = {
  timezone: string;
  expectedDailyMinutes: number;
  defaultStartTime: string;
  defaultEndTime?: string;
  lateGracePeriodMinutes: number;
  lunchBreakEnabled?: boolean;
  lunchMode?: "FIXED" | "FLEXIBLE";
  fixedLunchStartTime?: string | null;
  fixedLunchEndTime?: string | null;
  allowMultipleLunchBreaks?: boolean;
};

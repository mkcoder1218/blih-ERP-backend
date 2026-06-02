import { calculateAttendanceDay } from "../src/services/attendanceCalculation.service";

function mkSettings(overrides: Partial<any> = {}) {
  return {
    timezone: "Africa/Nairobi",
    expectedDailyMinutes: 480,
    defaultStartTime: "09:00",
    lateGracePeriodMinutes: 10,
    ...overrides,
  };
}

function d(iso: string) {
  return new Date(iso);
}

describe("Attendance calculation (Phase 5 hardening)", () => {
  it("calculates check-in -> check-out without breaks", () => {
    const settings = mkSettings();
    const dayStart = d("2026-05-31T00:00:00.000Z");
    const dayEnd = d("2026-06-01T00:00:00.000Z");
    const { calculation, normalized } = calculateAttendanceDay({
      settings,
      dayStartUtc: dayStart,
      dayEndUtc: dayEnd,
      nowUtc: d("2026-05-31T12:00:00.000Z"),
      events: [
        { type: "CHECK_IN", timestampUtc: d("2026-05-31T06:00:00.000Z") },
        { type: "CHECK_OUT", timestampUtc: d("2026-05-31T14:00:00.000Z") },
      ],
    });
    expect(normalized.checkInAtUtc).toBeTruthy();
    expect(normalized.checkOutAtUtc).toBeTruthy();
    expect(calculation.totalWorkedMinutes).toBe(480);
    expect(calculation.totalBreakMinutes).toBe(0);
    expect(calculation.overtimeMinutes).toBe(0);
    expect(calculation.missingMinutes).toBe(0);
    expect(calculation.currentStatus).toBe("COMPLETED");
  });

  it("calculates with a lunch break (out/in)", () => {
    const settings = mkSettings();
    const dayStart = d("2026-05-31T00:00:00.000Z");
    const dayEnd = d("2026-06-01T00:00:00.000Z");
    const { calculation } = calculateAttendanceDay({
      settings,
      dayStartUtc: dayStart,
      dayEndUtc: dayEnd,
      nowUtc: d("2026-05-31T20:00:00.000Z"),
      events: [
        { type: "CHECK_IN", timestampUtc: d("2026-05-31T06:00:00.000Z") },
        { type: "LUNCH_OUT", timestampUtc: d("2026-05-31T10:00:00.000Z") },
        { type: "LUNCH_IN", timestampUtc: d("2026-05-31T10:30:00.000Z") },
        { type: "CHECK_OUT", timestampUtc: d("2026-05-31T14:30:00.000Z") },
      ],
    });
    expect(calculation.totalWorkedMinutes).toBe(480);
    expect(calculation.totalBreakMinutes).toBe(30);
  });

  it("supports multiple breaks", () => {
    const settings = mkSettings({ expectedDailyMinutes: 600 });
    const dayStart = d("2026-05-31T00:00:00.000Z");
    const dayEnd = d("2026-06-01T00:00:00.000Z");
    const { calculation } = calculateAttendanceDay({
      settings,
      dayStartUtc: dayStart,
      dayEndUtc: dayEnd,
      nowUtc: d("2026-05-31T22:00:00.000Z"),
      events: [
        { type: "CHECK_IN", timestampUtc: d("2026-05-31T06:00:00.000Z") },
        { type: "LUNCH_OUT", timestampUtc: d("2026-05-31T08:00:00.000Z") },
        { type: "LUNCH_IN", timestampUtc: d("2026-05-31T08:10:00.000Z") },
        { type: "LUNCH_OUT", timestampUtc: d("2026-05-31T10:00:00.000Z") },
        { type: "LUNCH_IN", timestampUtc: d("2026-05-31T10:20:00.000Z") },
        { type: "CHECK_OUT", timestampUtc: d("2026-05-31T15:00:00.000Z") },
      ],
    });
    expect(calculation.totalBreakMinutes).toBe(30);
    // Worked: (06-08)=120 + (08:10-10)=110 + (10:20-15)=280 => 510
    expect(calculation.totalWorkedMinutes).toBe(510);
    expect(calculation.missingMinutes).toBe(90);
  });

  it("calculates in-progress work to now", () => {
    const settings = mkSettings();
    const dayStart = d("2026-05-31T00:00:00.000Z");
    const dayEnd = d("2026-06-01T00:00:00.000Z");
    const { calculation } = calculateAttendanceDay({
      settings,
      dayStartUtc: dayStart,
      dayEndUtc: dayEnd,
      nowUtc: d("2026-05-31T08:00:00.000Z"),
      events: [{ type: "CHECK_IN", timestampUtc: d("2026-05-31T06:00:00.000Z") }],
    });
    expect(calculation.totalWorkedMinutes).toBe(120);
    expect(calculation.currentStatus).toBe("IN_PROGRESS");
  });
});


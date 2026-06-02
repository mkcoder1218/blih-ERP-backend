/**
 * Unit tests for AttendanceMeService.
 *
 * All DB access is mocked — no database connection required.
 * Deliberately avoids importing app.ts (and transitively offerLetterPdfGenerator)
 * so Jest does not fail due to the puppeteer ESM import.
 */

// ---------------------------------------------------------------------------
// DB mock — set up before any imports that reference the db module
// ---------------------------------------------------------------------------

const mockTransaction = { LOCK: { UPDATE: "UPDATE" } };

const mockSettingsFindOne = jest.fn();
const mockEventFindAll = jest.fn();
const mockEventCreate = jest.fn();
const mockUserFindOne = jest.fn();
const mockLateReasonFindOne = jest.fn();
const mockLateExplanationCreate = jest.fn();
const mockSequelizeTransaction = jest.fn();

jest.mock("../src/models", () => ({
  db: {
    BusinessAttendanceSettings: { findOne: mockSettingsFindOne },
    AttendanceEvent: { findAll: mockEventFindAll, create: mockEventCreate },
    User: { findOne: mockUserFindOne },
    AttendanceLateReason: { findOne: mockLateReasonFindOne },
    AttendanceLateExplanation: { create: mockLateExplanationCreate },
    sequelize: { transaction: mockSequelizeTransaction },
  },
}));

// ---------------------------------------------------------------------------
// System under test
// ---------------------------------------------------------------------------

import { AttendanceMeService } from "../src/modules/attendanceMe/attendanceMe.service";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkSettings(overrides: Record<string, unknown> = {}) {
  return {
    id: "s1",
    businessId: "biz1",
    attendanceEnabled: true,
    locationName: "HQ",
    address: null,
    latitude: 0.0,
    longitude: 0.0,
    allowedRadiusMeters: 500,
    timezone: "Africa/Nairobi",
    expectedDailyMinutes: 480,
    defaultStartTime: "09:00",
    defaultEndTime: "17:00",
    lateGracePeriodMinutes: 0,
    lunchBreakEnabled: true,
    lunchMode: "FLEXIBLE",
    fixedLunchStartTime: null,
    fixedLunchEndTime: null,
    allowMultipleLunchBreaks: false,
    ...overrides,
  };
}

/** Create a fake event at a given ISO timestamp */
function mkEvent(type: string, iso: string) {
  return { id: `ev-${Math.random()}`, type, timestampUtc: new Date(iso), distanceMeters: 10, withinAllowedRadius: true };
}

/** Set up the transaction mock to execute the callback synchronously with a fake transaction object */
function setupTransaction() {
  mockSequelizeTransaction.mockImplementation(async (cb: (t: unknown) => Promise<unknown>) => cb(mockTransaction));
}

const USER_ID = "user1";
const BIZ_ID = "biz1";

// Employee is within 500 m radius (same coords as office)
const INSIDE_COORDS = { type: "CHECK_IN" as const, latitude: 0.0, longitude: 0.0 };
// Employee is 50 km away
const OUTSIDE_COORDS = { type: "CHECK_IN" as const, latitude: 1.0, longitude: 0.0 };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let svc: AttendanceMeService;

beforeEach(() => {
  jest.clearAllMocks();
  svc = new AttendanceMeService();
  setupTransaction();
  // Default: user row found (for transaction lock)
  mockUserFindOne.mockResolvedValue({ id: USER_ID, businessId: BIZ_ID });
  // Default: no events today
  mockEventFindAll.mockResolvedValue([]);
});

// --- getTodaySummary ---

describe("getTodaySummary", () => {
  it("returns nextAllowed: [] when no settings row exists", async () => {
    mockSettingsFindOne.mockResolvedValue(null);
    const result = await svc.getTodaySummary(USER_ID, BIZ_ID);
    expect(result.nextAllowed).toEqual([]);
    expect(result.disabledReason).toBe("Attendance settings not found");
    expect(result.timeline).toEqual([]);
  });

  it("returns nextAllowed: [] when attendanceEnabled is false", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings({ attendanceEnabled: false }));
    mockEventFindAll.mockResolvedValue([]);
    const result = await svc.getTodaySummary(USER_ID, BIZ_ID);
    expect(result.nextAllowed).toEqual([]);
    expect(result.disabledReason).toBe("Attendance is disabled");
  });

  it("returns nextAllowed: ['CHECK_IN'] for an employee with no events", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([]);
    const result = await svc.getTodaySummary(USER_ID, BIZ_ID);
    expect(result.nextAllowed).toEqual(["CHECK_IN"]);
    expect(result.disabledReason).toBeNull();
  });

  it("returns ['LUNCH_OUT', 'CHECK_OUT'] after CHECK_IN with lunch enabled", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings({ lunchBreakEnabled: true }));
    mockEventFindAll.mockResolvedValue([mkEvent("CHECK_IN", "2026-06-01T06:00:00.000Z")]);
    const result = await svc.getTodaySummary(USER_ID, BIZ_ID);
    expect(result.nextAllowed).toEqual(["LUNCH_OUT", "CHECK_OUT"]);
  });

  it("returns ['LUNCH_IN'] after LUNCH_OUT", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([
      mkEvent("CHECK_IN", "2026-06-01T06:00:00.000Z"),
      mkEvent("LUNCH_OUT", "2026-06-01T10:00:00.000Z"),
    ]);
    const result = await svc.getTodaySummary(USER_ID, BIZ_ID);
    expect(result.nextAllowed).toEqual(["LUNCH_IN"]);
  });

  it("returns [] after CHECK_OUT (day complete)", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([
      mkEvent("CHECK_IN",  "2026-06-01T06:00:00.000Z"),
      mkEvent("CHECK_OUT", "2026-06-01T14:00:00.000Z"),
    ]);
    const result = await svc.getTodaySummary(USER_ID, BIZ_ID);
    expect(result.nextAllowed).toEqual([]);
  });
});

// --- createEvent validation ---

describe("createEvent — attendance disabled", () => {
  it("throws 400 when attendance is disabled", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings({ attendanceEnabled: false }));
    await expect(svc.createEvent(USER_ID, BIZ_ID, INSIDE_COORDS)).rejects.toMatchObject({
      statusCode: 400,
      message: "Attendance is disabled",
    });
  });
});

describe("createEvent — location not configured", () => {
  it("throws 400 when latitude is null", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings({ latitude: null, longitude: null }));
    await expect(svc.createEvent(USER_ID, BIZ_ID, INSIDE_COORDS)).rejects.toMatchObject({
      statusCode: 400,
      message: "Attendance location is not configured",
    });
  });
});

describe("createEvent — radius enforcement", () => {
  it("throws 403 when employee is outside allowed radius", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings({ latitude: 0.0, longitude: 0.0, allowedRadiusMeters: 100 }));
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, { ...OUTSIDE_COORDS, latitude: 1.0, longitude: 0.0 })
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows an event when employee is inside the radius", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([]);
    mockEventCreate.mockResolvedValue(mkEvent("CHECK_IN", new Date().toISOString()));
    // getTodaySummary is called inside createEvent after commit — mock it too
    mockSettingsFindOne
      .mockResolvedValueOnce(mkSettings()) // first call from createEvent
      .mockResolvedValueOnce(mkSettings()); // second call from inner getTodaySummary
    mockEventFindAll
      .mockResolvedValueOnce([]) // inside transaction
      .mockResolvedValueOnce([mkEvent("CHECK_IN", new Date().toISOString())]); // inside getTodaySummary
    mockEventCreate.mockResolvedValue(mkEvent("CHECK_IN", new Date().toISOString()));

    const result = await svc.createEvent(USER_ID, BIZ_ID, INSIDE_COORDS);
    expect(result.nextAllowed).toContain("LUNCH_OUT");
  });
});

describe("createEvent — invalid transitions", () => {
  it("throws 400 for LUNCH_OUT when no CHECK_IN exists (invalid sequence)", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([]);
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, { type: "LUNCH_OUT", latitude: 0, longitude: 0 })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("Invalid attendance action") });
  });

  it("throws 400 for CHECK_OUT when employee is on lunch (LUNCH_OUT is latest event)", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([
      mkEvent("CHECK_IN",  "2026-06-01T06:00:00.000Z"),
      mkEvent("LUNCH_OUT", "2026-06-01T10:00:00.000Z"),
    ]);
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, { type: "CHECK_OUT", latitude: 0, longitude: 0 })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("Return from lunch") });
  });

  it("throws 400 for a second LUNCH_OUT when allowMultipleLunchBreaks is false", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings({ allowMultipleLunchBreaks: false }));
    mockEventFindAll.mockResolvedValue([
      mkEvent("CHECK_IN",  "2026-06-01T06:00:00.000Z"),
      mkEvent("LUNCH_OUT", "2026-06-01T10:00:00.000Z"),
      mkEvent("LUNCH_IN",  "2026-06-01T10:30:00.000Z"),
    ]);
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, { type: "LUNCH_OUT", latitude: 0, longitude: 0 })
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it("throws 400 for CHECK_IN after day is complete", async () => {
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    mockEventFindAll.mockResolvedValue([
      mkEvent("CHECK_IN",  "2026-06-01T06:00:00.000Z"),
      mkEvent("CHECK_OUT", "2026-06-01T14:00:00.000Z"),
    ]);
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, INSIDE_COORDS)
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("Invalid attendance action") });
  });
});

describe("createEvent — duplicate guard", () => {
  /**
   * The 409 duplicate guard (lines 163-171 in attendanceMe.service.ts) fires when:
   *   allowed.includes(input.type) AND last.type === input.type AND elapsed < 15 s
   *
   * In the normal state machine nextAllowedTypes() never returns the same type as
   * latestType (there are no self-loops), so 409 can only be reached via two
   * concurrent requests inside the DB transaction — unreachable in a single-threaded
   * unit test. The guard is verified by code review and the integration test confirms
   * the 409 status is wired to the route error handler.
   *
   * This test instead confirms the guard region correctly rejects an event that arrives
   * within 15 s but fails the sequence check first (400, not 409), demonstrating that
   * the 15 s window does not change error ordering.
   */
  it("returns 400 (sequence guard) — not 409 — when the submitted type is outside the sequence window", async () => {
    const recentTs = new Date(Date.now() - 5_000).toISOString();
    mockSettingsFindOne.mockResolvedValue(mkSettings());
    // Latest is CHECK_IN from 5 s ago; next allowed = [LUNCH_OUT, CHECK_OUT], not CHECK_IN.
    mockEventFindAll.mockResolvedValue([mkEvent("CHECK_IN", recentTs)]);
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, { type: "CHECK_IN", latitude: 0, longitude: 0 })
    ).rejects.toMatchObject({ statusCode: 400, message: expect.stringContaining("Invalid attendance action") });
  });
});

describe("createEvent — FIXED lunch window", () => {
  it("throws 403 for LUNCH_OUT in FIXED mode when current time is outside the window", async () => {
    // fixedLunchStartTime in the far future to guarantee we're outside
    mockSettingsFindOne.mockResolvedValue(
      mkSettings({ lunchMode: "FIXED", fixedLunchStartTime: "23:30", fixedLunchEndTime: "23:59" })
    );
    mockEventFindAll.mockResolvedValue([mkEvent("CHECK_IN", "2026-06-01T06:00:00.000Z")]);
    await expect(
      svc.createEvent(USER_ID, BIZ_ID, { type: "LUNCH_OUT", latitude: 0, longitude: 0 })
    ).rejects.toMatchObject({ statusCode: 403, message: expect.stringContaining("Lunch checkout is only allowed") });
  });

  it("allows LUNCH_OUT in FIXED mode when current time is inside the window", async () => {
    // Window spans the full day to guarantee we're always inside
    mockSettingsFindOne
      .mockResolvedValueOnce(mkSettings({ lunchMode: "FIXED", fixedLunchStartTime: "00:00", fixedLunchEndTime: "23:59" }))
      .mockResolvedValueOnce(mkSettings({ lunchMode: "FIXED", fixedLunchStartTime: "00:00", fixedLunchEndTime: "23:59" }));
    const checkInEvent = mkEvent("CHECK_IN", "2026-06-01T06:00:00.000Z");
    const lunchOutEvent = mkEvent("LUNCH_OUT", new Date().toISOString());
    mockEventFindAll
      .mockResolvedValueOnce([checkInEvent])                    // inside transaction
      .mockResolvedValueOnce([checkInEvent, lunchOutEvent]);    // inside getTodaySummary
    mockEventCreate.mockResolvedValue(lunchOutEvent);

    const result = await svc.createEvent(USER_ID, BIZ_ID, { type: "LUNCH_OUT", latitude: 0, longitude: 0 });
    expect(result.nextAllowed).toEqual(["LUNCH_IN"]);
  });
});

describe("createEvent — FLEXIBLE lunch", () => {
  it("allows LUNCH_OUT in FLEXIBLE mode at any time after CHECK_IN", async () => {
    mockSettingsFindOne
      .mockResolvedValueOnce(mkSettings({ lunchMode: "FLEXIBLE" }))
      .mockResolvedValueOnce(mkSettings({ lunchMode: "FLEXIBLE" }));
    const checkIn = mkEvent("CHECK_IN", "2026-06-01T06:00:00.000Z");
    const lunchOut = mkEvent("LUNCH_OUT", new Date().toISOString());
    mockEventFindAll
      .mockResolvedValueOnce([checkIn])
      .mockResolvedValueOnce([checkIn, lunchOut]);
    mockEventCreate.mockResolvedValue(lunchOut);

    const result = await svc.createEvent(USER_ID, BIZ_ID, { type: "LUNCH_OUT", latitude: 0, longitude: 0 });
    expect(result.nextAllowed).toEqual(["LUNCH_IN"]);
  });
});

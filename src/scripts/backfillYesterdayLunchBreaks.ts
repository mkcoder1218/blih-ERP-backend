import { Op, Transaction } from "sequelize";
import { sequelize } from "../database/sequelize";
import { db } from "../models";
import { businessDateEndUtc, businessDateStartUtc, localWallTimeToUtc } from "../utils/timezone";

type AttendanceEventType = "CHECK_IN" | "LUNCH_OUT" | "LUNCH_IN" | "CHECK_OUT";

const LUNCH_MINUTES = 60;

function formatDateInTimeZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(dateYmd: string, days: number) {
  const [year, month, day] = dateYmd.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function minutesFromHHmm(hhmm: string) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

function hhmmFromMinutes(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function eventTime(event: any) {
  return new Date(event.timestampUtc).getTime();
}

function pickConfiguredLunchWindow(params: {
  checkInAt: Date;
  checkOutAt: Date;
  dateYmd: string;
  timeZone: string;
  settings: any;
}) {
  const { checkInAt, checkOutAt, dateYmd, timeZone, settings } = params;
  const checkInMs = checkInAt.getTime();
  const checkOutMs = checkOutAt.getTime();
  const shiftMs = checkOutMs - checkInMs;
  const lunchMs = LUNCH_MINUTES * 60 * 1000;

  if (shiftMs <= lunchMs) return null;

  const lunchStart = String(process.env.LUNCH_START_TIME || settings.fixedLunchStartTime || "13:00");
  const startMinutes = minutesFromHHmm(lunchStart);
  const lunchEnd = hhmmFromMinutes(startMinutes + LUNCH_MINUTES);
  const lunchOutAt = localWallTimeToUtc(dateYmd, lunchStart, timeZone);
  const lunchInAt = localWallTimeToUtc(dateYmd, lunchEnd, timeZone);

  if (lunchOutAt.getTime() > checkInMs && lunchInAt.getTime() < checkOutMs) {
    return { lunchOutAt, lunchInAt };
  }

  return null;
}

async function createSyntheticLunchEvents(params: {
  businessId: string;
  employeeId: string;
  lunchOutAt: Date;
  lunchInAt: Date;
  transaction: Transaction;
}) {
  const basePayload = {
    businessId: params.businessId,
    employeeId: params.employeeId,
    latitude: 0,
    longitude: 0,
    distanceMeters: 0,
    withinAllowedRadius: true,
  };

  await db.AttendanceEvent.bulkCreate(
    [
      { ...basePayload, type: "LUNCH_OUT", timestampUtc: params.lunchOutAt },
      { ...basePayload, type: "LUNCH_IN", timestampUtc: params.lunchInAt },
    ],
    { transaction: params.transaction }
  );
}

async function main() {
  const shouldApply = String(process.env.APPLY || "").toLowerCase() === "true";
  const businesses = await db.BusinessAttendanceSettings.findAll({ order: [["businessId", "ASC"]] });

  let eligible = 0;
  let insertedEvents = 0;
  let skippedAlreadyHasLunch = 0;
  let skippedIncomplete = 0;
  let skippedTooShort = 0;

  for (const settings of businesses as any[]) {
    const businessId = settings.businessId;
    const timeZone = settings.timezone || "UTC";
    const dateYmd = process.env.TARGET_DATE || addDays(formatDateInTimeZone(new Date(), timeZone), -1);
    const dayStartUtc = businessDateStartUtc(dateYmd, timeZone);
    const dayEndUtc = businessDateEndUtc(dateYmd, timeZone);

    const events = await db.AttendanceEvent.findAll({
      where: {
        businessId,
        timestampUtc: { [Op.gte]: dayStartUtc, [Op.lt]: dayEndUtc },
      },
      order: [["employeeId", "ASC"], ["timestampUtc", "ASC"]],
    });

    const byEmployee = new Map<string, any[]>();
    for (const event of events as any[]) {
      const employeeId = String(event.employeeId);
      const employeeEvents = byEmployee.get(employeeId) || [];
      employeeEvents.push(event);
      byEmployee.set(employeeId, employeeEvents);
    }

    for (const [employeeId, employeeEvents] of byEmployee.entries()) {
      const hasLunch = employeeEvents.some((event) => event.type === "LUNCH_OUT" || event.type === "LUNCH_IN");
      if (hasLunch) {
        skippedAlreadyHasLunch += 1;
        continue;
      }

      const checkIn = employeeEvents.filter((event) => event.type === "CHECK_IN").sort((a, b) => eventTime(a) - eventTime(b))[0];
      const checkOut = employeeEvents.filter((event) => event.type === "CHECK_OUT").sort((a, b) => eventTime(a) - eventTime(b)).at(-1);

      if (!checkIn || !checkOut || eventTime(checkOut) <= eventTime(checkIn)) {
        skippedIncomplete += 1;
        continue;
      }

      const lunchWindow = pickConfiguredLunchWindow({
        checkInAt: new Date(checkIn.timestampUtc),
        checkOutAt: new Date(checkOut.timestampUtc),
        dateYmd,
        timeZone,
        settings,
      });

      if (!lunchWindow) {
        skippedTooShort += 1;
        continue;
      }

      eligible += 1;
      console.log(
        `${shouldApply ? "Backfilling" : "Would backfill"} ${dateYmd} business=${businessId} employee=${employeeId} lunchOut=${lunchWindow.lunchOutAt.toISOString()} lunchIn=${lunchWindow.lunchInAt.toISOString()}`
      );

      if (shouldApply) {
        await sequelize.transaction(async (transaction) => {
          const existingLunch = await db.AttendanceEvent.findOne({
            where: {
              businessId,
              employeeId,
              type: { [Op.in]: ["LUNCH_OUT", "LUNCH_IN"] as AttendanceEventType[] },
              timestampUtc: { [Op.gte]: dayStartUtc, [Op.lt]: dayEndUtc },
            },
            transaction,
            lock: transaction.LOCK.UPDATE,
          });

          if (!existingLunch) {
            await createSyntheticLunchEvents({
              businessId,
              employeeId,
              lunchOutAt: lunchWindow.lunchOutAt,
              lunchInAt: lunchWindow.lunchInAt,
              transaction,
            });
            insertedEvents += 2;
          }
        });
      }
    }
  }

  console.log(
    [
      shouldApply ? "Applied yesterday lunch backfill." : "Dry run complete. Re-run with APPLY=true to write changes.",
      `Eligible employees: ${eligible}.`,
      `Inserted events: ${insertedEvents}.`,
      `Skipped with lunch already: ${skippedAlreadyHasLunch}.`,
      `Skipped incomplete days: ${skippedIncomplete}.`,
      `Skipped shifts too short: ${skippedTooShort}.`,
    ].join(" ")
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

import { Op } from "sequelize";
import { sequelize } from "../database/sequelize";
import { db } from "../models";
import { businessDateEndUtc, businessDateStartUtc } from "../utils/timezone";

async function main() {
  const approvedCorrections = await db.AttendanceRequest.findAll({
    where: {
      requestType: "check_in_correction",
      status: "approved",
      fromAt: { [Op.ne]: null },
    },
    order: [["updatedAt", "ASC"]],
  });

  let updated = 0;
  let created = 0;

  for (const correction of approvedCorrections as any[]) {
    const settings = await db.BusinessAttendanceSettings.findOne({ where: { businessId: correction.businessId } });
    const tz = settings?.timezone || "UTC";
    const correctedAtUtc = new Date(correction.fromAt);
    const correctionDate = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(correctedAtUtc);
    const dayStartUtc = businessDateStartUtc(correctionDate, tz);
    const dayEndUtc = businessDateEndUtc(correctionDate, tz);

    const existing = await db.AttendanceEvent.findOne({
      where: {
        businessId: correction.businessId,
        employeeId: correction.employeeUserId,
        type: correction.category,
        timestampUtc: { [Op.gte]: dayStartUtc, [Op.lt]: dayEndUtc },
      },
      order: [["timestampUtc", "ASC"]],
    });

    const payload = {
      businessId: correction.businessId,
      employeeId: correction.employeeUserId,
      type: correction.category,
      timestampUtc: correctedAtUtc,
      latitude: 0,
      longitude: 0,
      distanceMeters: 0,
      withinAllowedRadius: true,
    };

    if (existing) {
      await existing.update(payload);
      updated += 1;
    } else {
      await db.AttendanceEvent.create(payload);
      created += 1;
    }
  }

  console.log(`Synced ${approvedCorrections.length} approved attendance corrections. Updated ${updated}, created ${created}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });

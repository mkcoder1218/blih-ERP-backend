import { AttendanceSettingsDAL } from "./attendanceSettings.dal";
import { db } from "../../models";

const DEFAULTS = {
  attendanceEnabled: false,
  locationName: null,
  address: null,
  latitude: null,
  longitude: null,
  allowedRadiusMeters: 100,
  timezone: "UTC",
  expectedDailyMinutes: 480,
  defaultStartTime: "09:00",
  defaultEndTime: "17:00",
  lateGracePeriodMinutes: 0
};

export class AttendanceSettingsService {
  private dal = new AttendanceSettingsDAL();

  async getOrCreateForBusiness(businessId: string) {
    const existing = await db.BusinessAttendanceSettings.findOne({ where: { businessId } });
    if (existing) return existing;
    return this.dal.create({ businessId, ...DEFAULTS });
  }

  async upsertForBusiness(businessId: string, payload: any) {
    const [record] = await db.BusinessAttendanceSettings.findOrCreate({
      where: { businessId },
      defaults: { businessId, ...DEFAULTS }
    });
    await record.update({ ...payload });
    return record;
  }
}


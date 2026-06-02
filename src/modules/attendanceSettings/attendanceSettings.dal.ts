import { BaseDAL } from "../../database/BaseDAL";
import { db } from "../../models";

export class AttendanceSettingsDAL extends BaseDAL {
  constructor() {
    super(db.BusinessAttendanceSettings);
  }
}


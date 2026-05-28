import { BaseDAL } from "../../database/BaseDAL";
import { db } from "../../models";

export class ProfileTemplateDAL extends BaseDAL {
  constructor() {
    super(db.ProfileTemplate);
  }
}


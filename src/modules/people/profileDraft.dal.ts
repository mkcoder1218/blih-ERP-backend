import { BaseDAL } from "../../database/BaseDAL";
import { db } from "../../models";

export class ProfileDraftDAL extends BaseDAL {
  constructor() {
    super(db.ProfileDraft);
  }
}


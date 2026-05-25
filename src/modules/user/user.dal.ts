import { BaseDAL } from "../../database/BaseDAL";
import { db } from "../../models";

export class UserDAL extends BaseDAL {
  constructor() {
    super(db.User);
  }
}


import { BaseDAL } from "../../database/BaseDAL";
import { db } from "../../models";

export class RoleDAL extends BaseDAL {
  constructor() {
    super(db.Role);
  }
}


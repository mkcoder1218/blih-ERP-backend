import { BaseDAL } from "../../database/BaseDAL";
import { db } from "../../models";

export class BusinessDAL extends BaseDAL {
  constructor() {
    super(db.Business);
  }
}


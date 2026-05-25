import { BaseDAL } from "../../database/BaseDAL";

export class SectorFocusDAL extends BaseDAL {
  constructor() {
    const { db } = require("../../models");
    super(db.SectorFocus);
  }
}


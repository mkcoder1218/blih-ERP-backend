import { SectorFocusDAL } from "./sectorFocus.dal";

export class SectorFocusService {
  private dal = new SectorFocusDAL();

  list() {
    return this.dal.findAll();
  }

  getById(id: string) {
    return this.dal.findById(id);
  }

  create(data: any) {
    return this.dal.create(data);
  }

  update(id: string, data: any) {
    return this.dal.update(id, data);
  }

  remove(id: string) {
    return this.dal.softDelete(id);
  }
}


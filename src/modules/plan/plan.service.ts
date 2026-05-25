
import { PlanDAL } from './plan.dal';
export class PlanService {
  private dal = new PlanDAL();
  list() { return this.dal.findAll(); }
  getById(id: string) { return this.dal.findById(id); }
  create(data: any) { return this.dal.create(data); }
  update(id: string, data: any) { return this.dal.update(id, data); }
  remove(id: string) { return this.dal.softDelete(id); }
}

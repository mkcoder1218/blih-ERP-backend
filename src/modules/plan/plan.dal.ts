
import { db } from '../../models';
export class PlanDAL {
  findAll() { return db.Plan.findAll(); }
  findById(id: string) { return db.Plan.findByPk(id); }
  create(data: any) { return db.Plan.create(data); }
  async update(id: string, data: any) {
    const plan = await db.Plan.findByPk(id);
    if (!plan) return null;
    return plan.update(data);
  }
}

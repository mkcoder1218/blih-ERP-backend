
import { db } from '../../models';
export class BusinessModuleDAL {
  findAll(query: any) { return db.BusinessModule.findAll({ where: query }); }
  findById(id: string) { return db.BusinessModule.findByPk(id); }
  async update(id: string, data: any) {
    const mod = await db.BusinessModule.findByPk(id);
    if (!mod) return null;
    return mod.update(data);
  }
}

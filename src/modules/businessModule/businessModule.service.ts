
import { BusinessModuleDAL } from './businessModule.dal';
export class BusinessModuleService {
  private dal = new BusinessModuleDAL();
  list(businessId: string) { return this.dal.findAll({ businessId }); }
  getById(id: string, businessId: string) { return this.dal.findAll({ id, businessId }).then((res: any[]) => res[0]); }
  update(id: string, businessId: string, data: any) { return this.dal.update(id, data); }
}

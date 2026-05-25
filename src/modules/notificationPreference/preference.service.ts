
import { PreferenceDAL } from './preference.dal';
export class PreferenceService {
  private dal = new PreferenceDAL();
  listMine(businessId: string, userId: string) { return this.dal.findForUser(businessId, userId); }
  updateMine(businessId: string, userId: string, data: any) { return this.dal.upsert({ ...data, businessId, userId }); }
}

import { ProfileTemplateDAL } from "./profileTemplate.dal";
import { db } from "../../models";

export class ProfileTemplateService {
  private dal = new ProfileTemplateDAL();

  list(businessId: string) {
    return this.dal.findAll({ businessId }, { order: [["createdAt", "DESC"]] });
  }

  getById(id: string, businessId: string) {
    return db.ProfileTemplate.findOne({ where: { id, businessId } });
  }

  create(businessId: string, data: any) {
    return this.dal.create({ ...data, businessId });
  }

  update(id: string, businessId: string, data: any) {
    return db.ProfileTemplate.findOne({ where: { id, businessId } }).then((t: any) => (t ? t.update(data) : null));
  }

  remove(id: string, businessId: string) {
    return db.ProfileTemplate.findOne({ where: { id, businessId } }).then((t: any) => (t ? t.destroy() : null));
  }
}


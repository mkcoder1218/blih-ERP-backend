
import { AttachmentDAL } from './attachment.dal';
import { InternalNotifier } from '../notification/notification.service';

export class AttachmentService {
  private dal = new AttachmentDAL();

  list(businessId: string, entityType: string, entityId: string, page: number, size: number) {
    const offset = (page - 1) * size;
    const query: any = { businessId };
    if (entityType) query.entityType = entityType;
    if (entityId) query.entityId = entityId;
    return this.dal.findAll(query, offset, size);
  }
  
  async create(businessId: string, data: any) { 
    const att = await this.dal.create({ ...data, businessId });
    // Attempting optional placeholder notification hook
    // Usually we would map entityId -> OwnerId, but here we provide a logged safety console or placeholder query
    // InternalNotifier.send({ ... }) 
    return att;
  }
  softDelete(id: string, businessId: string) { return this.dal.softDelete(id, businessId); }
}

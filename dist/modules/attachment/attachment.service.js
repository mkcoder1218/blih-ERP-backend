"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentService = void 0;
const attachment_dal_1 = require("./attachment.dal");
class AttachmentService {
    constructor() {
        this.dal = new attachment_dal_1.AttachmentDAL();
    }
    list(businessId, entityType, entityId, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (entityType)
            query.entityType = entityType;
        if (entityId)
            query.entityId = entityId;
        return this.dal.findAll(query, offset, size);
    }
    async create(businessId, data) {
        const att = await this.dal.create({ ...data, businessId });
        // Attempting optional placeholder notification hook
        // Usually we would map entityId -> OwnerId, but here we provide a logged safety console or placeholder query
        // InternalNotifier.send({ ... }) 
        return att;
    }
    softDelete(id, businessId) { return this.dal.softDelete(id, businessId); }
}
exports.AttachmentService = AttachmentService;

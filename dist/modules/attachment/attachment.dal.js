"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AttachmentDAL = void 0;
const models_1 = require("../../models");
class AttachmentDAL {
    findAll(query, offset, limit) {
        return models_1.db.EntityAttachment.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']], include: [models_1.db.FileAsset] });
    }
    findById(id, businessId) { return models_1.db.EntityAttachment.findOne({ where: { id, businessId }, include: [models_1.db.FileAsset] }); }
    create(data) { return models_1.db.EntityAttachment.create(data); }
    async softDelete(id, businessId) {
        const att = await models_1.db.EntityAttachment.findOne({ where: { id, businessId } });
        if (att) {
            await att.destroy();
            return true;
        }
        return false;
    }
}
exports.AttachmentDAL = AttachmentDAL;

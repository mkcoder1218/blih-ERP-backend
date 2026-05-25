"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileDAL = void 0;
const models_1 = require("../../models");
class FileDAL {
    findAll(query, offset, limit) {
        return models_1.db.FileAsset.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    findById(id, businessId) { return models_1.db.FileAsset.findOne({ where: { id, businessId } }); }
    create(data) { return models_1.db.FileAsset.create(data); }
    async softDelete(id, businessId) {
        const asset = await models_1.db.FileAsset.findOne({ where: { id, businessId } });
        if (asset) {
            await asset.update({ status: 'deleted' });
            await asset.destroy();
            return true;
        }
        return false;
    }
}
exports.FileDAL = FileDAL;

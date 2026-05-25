"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PositionDAL = void 0;
const models_1 = require("../../models");
class PositionDAL {
    findAll(query, offset, limit) {
        return models_1.db.Position.findAndCountAll({ where: query, offset, limit, order: [['createdAt', 'DESC']] });
    }
    findById(id, businessId) { return models_1.db.Position.findOne({ where: { id, businessId } }); }
    create(data) { return models_1.db.Position.create(data); }
    async update(id, businessId, data) {
        const pos = await models_1.db.Position.findOne({ where: { id, businessId } });
        if (!pos)
            return null;
        return pos.update(data);
    }
    async softDelete(id, businessId) {
        const pos = await models_1.db.Position.findOne({ where: { id, businessId } });
        if (!pos)
            return false;
        await pos.destroy();
        return true;
    }
}
exports.PositionDAL = PositionDAL;

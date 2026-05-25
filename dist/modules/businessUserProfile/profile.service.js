"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileService = void 0;
const profile_dal_1 = require("./profile.dal");
const sequelize_1 = require("sequelize");
class ProfileService {
    constructor() {
        this.dal = new profile_dal_1.ProfileDAL();
    }
    list(businessId, search, page, size) {
        const offset = (page - 1) * size;
        const query = { businessId };
        if (search)
            query.workEmail = { [sequelize_1.Op.iLike]: `%${search}%` };
        return this.dal.findAll(query, offset, size);
    }
    getById(id, businessId) { return this.dal.findById(id, businessId); }
    getByUserId(userId, businessId) { return this.dal.findByUserId(userId, businessId); }
    create(businessId, data) { return this.dal.create({ ...data, businessId }); }
    update(id, businessId, data) { return this.dal.update(id, businessId, data); }
    softDelete(id, businessId) { return this.dal.softDelete(id, businessId); }
}
exports.ProfileService = ProfileService;

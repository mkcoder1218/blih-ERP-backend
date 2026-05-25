"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseDAL = void 0;
class BaseDAL {
    constructor(model) {
        this.model = model;
    }
    async create(data, options = {}) {
        return this.model.create(data, options);
    }
    async findById(id, options = {}) {
        return this.model.findByPk(id, options);
    }
    async findAll(where = {}, options = {}) {
        return this.model.findAll({ where, ...options });
    }
    async update(id, data, options = {}) {
        const instance = await this.model.findByPk(id, options);
        if (!instance)
            return null;
        return instance.update(data, options);
    }
    async delete(id, options = {}) {
        const instance = await this.model.findByPk(id, options);
        if (!instance)
            return null;
        await instance.destroy(options);
        return true;
    }
    async softDelete(id, options = {}) {
        const instance = await this.model.findByPk(id, options);
        if (!instance)
            return null;
        return instance.update({ deletedAt: new Date() }, options);
    }
}
exports.BaseDAL = BaseDAL;

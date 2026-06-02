"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseDAL = void 0;
class BaseDAL {
    constructor(model) {
        this.model = model;
    }
    create(data, options = {}) {
        return this.model.create(data, options);
    }
    findById(id, options = {}) {
        return this.model.findByPk(id, options);
    }
    findAll(where = {}, options = {}) {
        return this.model.findAll({ where, ...options });
    }
    findAndCount(where = {}, options = {}) {
        return this.model.findAndCountAll({ where, ...options });
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
        await instance.destroy({ ...options }); // paranoid => sets deletedAt
        return true;
    }
}
exports.BaseDAL = BaseDAL;

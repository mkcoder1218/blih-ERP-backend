export type FindAllOptions = Record<string, unknown>;
export type Options = Record<string, unknown>;

export class BaseDAL {
  protected model: any;

  constructor(model: any) {
    this.model = model;
  }

  create(data: unknown, options: Options = {}) {
    return this.model.create(data, options);
  }

  findById(id: string, options: Options = {}) {
    return this.model.findByPk(id, options);
  }

  findAll(where: Record<string, unknown> = {}, options: FindAllOptions = {}) {
    return this.model.findAll({ where, ...options });
  }

  findAndCount(where: Record<string, unknown> = {}, options: FindAllOptions = {}) {
    return this.model.findAndCountAll({ where, ...options });
  }

  async update(id: string, data: unknown, options: Options = {}) {
    const instance = await this.model.findByPk(id, options);
    if (!instance) return null;
    return instance.update(data, options);
  }

  async delete(id: string, options: Options = {}) {
    const instance = await this.model.findByPk(id, options);
    if (!instance) return null;
    await instance.destroy(options);
    return true;
  }

  async softDelete(id: string, options: Options = {}) {
    const instance = await this.model.findByPk(id, options);
    if (!instance) return null;
    await instance.destroy({ ...options }); // paranoid => sets deletedAt
    return true;
  }
}


import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type RoleModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): RoleModel => {
  const Role = sequelize.define(
    "Role",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: true },
      name: { type: dataTypes.STRING(120), allowNull: false },
      key: { type: dataTypes.STRING(120), allowNull: false },
      description: { type: dataTypes.STRING(255), allowNull: true },
      isSystemRole: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    },
    {
      tableName: "roles",
      timestamps: true,
      paranoid: true,
      indexes: [{ unique: true, fields: ["businessId", "key"] }]
    }
  ) as RoleModel;

  Role.associate = (models: any) => {
    models.Role.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Role.belongsToMany(models.Permission, { through: models.RolePermission, foreignKey: "roleId" });
    models.Role.belongsToMany(models.User, { through: models.UserRole, foreignKey: "roleId" });
  };

  return Role;
};


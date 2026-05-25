import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PermissionModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PermissionModel => {
  const Permission = sequelize.define(
    "Permission",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      module: { type: dataTypes.STRING(80), allowNull: false },
      action: { type: dataTypes.STRING(80), allowNull: false },
      key: { type: dataTypes.STRING(170), allowNull: false, unique: true },
      description: { type: dataTypes.STRING(255), allowNull: true }
    },
    { tableName: "permissions", timestamps: true }
  ) as PermissionModel;

  Permission.associate = (models: any) => {
    models.Permission.belongsToMany(models.Role, { through: models.RolePermission, foreignKey: "permissionId" });
  };

  return Permission;
};


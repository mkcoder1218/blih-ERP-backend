import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type RolePermissionModel = ModelStatic<any>;

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): RolePermissionModel => {
  return sequelize.define(
    "RolePermission",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      roleId: { type: dataTypes.UUID, allowNull: false },
      permissionId: { type: dataTypes.UUID, allowNull: false }
    },
    { tableName: "role_permissions", timestamps: true, indexes: [{ unique: true, fields: ["roleId", "permissionId"] }] }
  );
};


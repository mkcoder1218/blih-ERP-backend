import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type UserRoleModel = ModelStatic<any>;

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): UserRoleModel => {
  return sequelize.define(
    "UserRole",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      userId: { type: dataTypes.UUID, allowNull: false },
      roleId: { type: dataTypes.UUID, allowNull: false }
    },
    { tableName: "user_roles", timestamps: true, indexes: [{ unique: true, fields: ["userId", "roleId"] }] }
  );
};


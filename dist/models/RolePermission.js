"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    return sequelize.define("RolePermission", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        roleId: { type: dataTypes.UUID, allowNull: false },
        permissionId: { type: dataTypes.UUID, allowNull: false }
    }, { tableName: "role_permissions", timestamps: true, indexes: [{ unique: true, fields: ["roleId", "permissionId"] }] });
};

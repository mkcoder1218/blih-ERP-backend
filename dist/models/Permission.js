"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Permission = sequelize.define("Permission", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        module: { type: dataTypes.STRING(80), allowNull: false },
        action: { type: dataTypes.STRING(80), allowNull: false },
        key: { type: dataTypes.STRING(170), allowNull: false, unique: true },
        description: { type: dataTypes.STRING(255), allowNull: true }
    }, { tableName: "permissions", timestamps: true });
    Permission.associate = (models) => {
        models.Permission.belongsToMany(models.Role, { through: models.RolePermission, foreignKey: "permissionId" });
    };
    return Permission;
};

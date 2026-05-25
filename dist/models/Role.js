"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Role = sequelize.define("Role", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: true },
        name: { type: dataTypes.STRING(120), allowNull: false },
        key: { type: dataTypes.STRING(120), allowNull: false },
        description: { type: dataTypes.STRING(255), allowNull: true },
        isSystemRole: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false }
    }, {
        tableName: "roles",
        timestamps: true,
        paranoid: true,
        indexes: [{ unique: true, fields: ["businessId", "key"] }]
    });
    Role.associate = (models) => {
        models.Role.belongsTo(models.Business, { foreignKey: "businessId" });
        models.Role.belongsToMany(models.Permission, { through: models.RolePermission, foreignKey: "roleId" });
        models.Role.belongsToMany(models.User, { through: models.UserRole, foreignKey: "roleId" });
    };
    return Role;
};

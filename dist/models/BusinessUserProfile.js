"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const BusinessUserProfile = sequelize.define("BusinessUserProfile", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false, unique: true },
        departmentId: { type: dataTypes.UUID, allowNull: true },
        positionId: { type: dataTypes.UUID, allowNull: true },
        employeeCode: { type: dataTypes.STRING(100), allowNull: true },
        workEmail: { type: dataTypes.STRING(320), allowNull: true },
        workPhone: { type: dataTypes.STRING(50), allowNull: true },
        employmentType: { type: dataTypes.STRING(50), allowNull: true },
        joinedAt: { type: dataTypes.DATE, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: "active" },
        settings: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "business_user_profiles", timestamps: true, paranoid: true });
    BusinessUserProfile.associate = (models) => {
        models.BusinessUserProfile.belongsTo(models.Business, { foreignKey: "businessId" });
        models.BusinessUserProfile.belongsTo(models.User, { foreignKey: "userId" });
        models.BusinessUserProfile.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
        models.BusinessUserProfile.belongsTo(models.Position, { foreignKey: "positionId", as: "position" });
    };
    return BusinessUserProfile;
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const AttendanceRecord = sequelize.define("AttendanceRecord", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false },
        date: { type: dataTypes.DATEONLY, allowNull: false },
        checkInAt: { type: dataTypes.DATE, allowNull: true },
        checkOutAt: { type: dataTypes.DATE, allowNull: true },
        status: { type: dataTypes.STRING(50), defaultValue: 'present' }, // present, absent, half_day, late
        source: { type: dataTypes.STRING(50), defaultValue: 'web_portal' }, // device, portal, manual
        notes: { type: dataTypes.TEXT, allowNull: true }
    }, { tableName: "hr_attendance_records", timestamps: true });
    AttendanceRecord.associate = (models) => {
        models.AttendanceRecord.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            AttendanceRecord.belongsTo(models.User, { foreignKey: "userId" });
    };
    return AttendanceRecord;
};

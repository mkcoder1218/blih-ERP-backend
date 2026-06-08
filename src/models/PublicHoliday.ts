import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

/**
 * PublicHoliday — platform-level table (no businessId).
 * Holidays here are shared across ALL tenants and cannot be edited per-business.
 * Populated by the super admin via the Calendarific import worker.
 */
export type PublicHolidayModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PublicHolidayModel => {
  const PublicHoliday = sequelize.define(
    "PublicHoliday",
    {
      id:          { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      country:     { type: dataTypes.STRING(5),   allowNull: false }, // ISO 2-letter code
      year:        { type: dataTypes.INTEGER,      allowNull: false },
      name:        { type: dataTypes.STRING(255),  allowNull: false },
      description: { type: dataTypes.TEXT,         allowNull: true  },
      eventDate:   { type: dataTypes.DATEONLY,     allowNull: false },
      primaryType: { type: dataTypes.STRING(100),  allowNull: true  },
      emoji:       { type: dataTypes.STRING(10),   defaultValue: "🗓️" },
      canonicalUrl:{ type: dataTypes.STRING(500),  allowNull: true  },
      metadata:    { type: dataTypes.JSONB,        defaultValue: {} },
    },
    {
      tableName:  "platform_public_holidays",
      timestamps: true,
      paranoid:   true,
      indexes: [
        { unique: true, fields: ["country", "year", "name", "eventDate"] },
      ],
    }
  ) as PublicHolidayModel;

  // No associations — platform-level, no businessId
  return PublicHoliday;
};

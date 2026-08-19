import { DataTypes } from 'sequelize';
import { sequelize } from '../../database/sequelize';

export const ContentTranslation = sequelize.define(
  'ContentTranslation',
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    businessId: { type: DataTypes.UUID, allowNull: false },
    entityType: { type: DataTypes.STRING(120), allowNull: false },
    entityId: { type: DataTypes.STRING(191), allowNull: false },
    field: { type: DataTypes.STRING(120), allowNull: false },
    language: { type: DataTypes.STRING(10), allowNull: false },
    value: { type: DataTypes.TEXT, allowNull: false },
  },
  {
    tableName: 'localized_content_translations',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['businessId', 'entityType', 'entityId', 'field', 'language'],
        name: 'localized_content_translations_unique',
      },
      {
        fields: ['businessId', 'entityType', 'entityId'],
        name: 'localized_content_translations_entity_idx',
      },
    ],
  },
);

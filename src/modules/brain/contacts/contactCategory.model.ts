import { DataTypes } from "sequelize";
import { sequelize } from "../../../database/sequelize";

export const BRAIN_CONTACT_FIELD_TYPES = [
  "text",
  "long_text",
  "number",
  "phone",
  "email",
  "date",
  "url",
  "dropdown",
  "multi_select",
  "checkbox",
] as const;

export const BrainContactCategory =
  sequelize.models.BrainContactCategory ||
  sequelize.define(
    "BrainContactCategory",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(120), allowNull: false },
      iconName: { type: DataTypes.STRING(120), allowNull: false, defaultValue: "Users" },
      description: { type: DataTypes.STRING(500), allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      createdByUserId: { type: DataTypes.UUID, allowNull: true },
      updatedByUserId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "brain_contact_categories",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId", "isActive", "sortOrder"] },
        { fields: ["businessId", "name"] },
      ],
    },
  );

export const BrainContactField =
  sequelize.models.BrainContactField ||
  sequelize.define(
    "BrainContactField",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      key: { type: DataTypes.STRING(100), allowNull: false },
      label: { type: DataTypes.STRING(120), allowNull: false },
      type: { type: DataTypes.STRING(30), allowNull: false },
      isRequired: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      showInTable: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      isSystem: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      isArchived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      createdByUserId: { type: DataTypes.UUID, allowNull: true },
      updatedByUserId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "brain_contact_fields",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["categoryId", "key"] },
        { fields: ["businessId", "categoryId", "isArchived", "sortOrder"] },
      ],
    },
  );

export const BrainCustomContact =
  sequelize.models.BrainCustomContact ||
  sequelize.define(
    "BrainCustomContact",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.STRING(255), allowNull: false },
      values: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
      createdByUserId: { type: DataTypes.UUID, allowNull: true },
      updatedByUserId: { type: DataTypes.UUID, allowNull: true },
    },
    {
      tableName: "brain_custom_contacts",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId", "categoryId", "updatedAt"] },
        { fields: ["businessId", "categoryId", "name"] },
      ],
    },
  );

export const BrainContactColumnPreference =
  sequelize.models.BrainContactColumnPreference ||
  sequelize.define(
    "BrainContactColumnPreference",
    {
      id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
      businessId: { type: DataTypes.UUID, allowNull: false },
      userId: { type: DataTypes.UUID, allowNull: false },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      visibleFieldIds: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    },
    {
      tableName: "brain_contact_column_preferences",
      timestamps: true,
      indexes: [
        { unique: true, fields: ["userId", "categoryId"] },
        { fields: ["businessId", "categoryId"] },
      ],
    },
  );

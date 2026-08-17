import { DataTypes, Op } from "sequelize";
import { sequelize } from "../../../database/sequelize";

export const BRAIN_CONTACT_OPTION_TYPES = [
  "field",
  "behavior",
  "platform",
  "client_status",
  "client_type",
  "position",
  "company",
] as const;

export const BEHAVIOR_COLORS = [
  "#2563EB",
  "#7C3AED",
  "#DB2777",
  "#DC2626",
  "#EA580C",
  "#CA8A04",
  "#16A34A",
  "#059669",
  "#0891B2",
  "#475569",
] as const;

const SEEDED_OPTION_LABELS = new Set(
  [
    "Friendly",
    "Professional",
    "Difficult",
    "Responsive",
    "Slow Responder",
    "Negotiable",
    "High Priority",
    "Instagram",
    "TikTok",
    "YouTube",
    "Facebook",
    "Telegram",
    "Potential",
    "Active",
    "Inactive",
    "Past Client",
  ].map((label) => label.toLowerCase()),
);

export const BrainContactOption =
  sequelize.models.BrainContactOption ||
  sequelize.define(
    "BrainContactOption",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: {
        type: DataTypes.UUID,
        allowNull: false,
      },
      type: {
        type: DataTypes.STRING(40),
        allowNull: false,
      },
      label: {
        type: DataTypes.STRING(120),
        allowNull: false,
      },
      color: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      createdByUserId: {
        type: DataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "brain_contact_options",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId", "type"] },
        { fields: ["businessId", "type", "label"] },
      ],
      hooks: {
        beforeFind: (options: any) => {
          const labelCondition = options?.where?.label;
          const comparedLabel = labelCondition?.[Op.iLike];
          if (
            typeof comparedLabel === "string" &&
            SEEDED_OPTION_LABELS.has(comparedLabel.toLowerCase())
          ) {
            options.paranoid = false;
          }
        },
      },
    },
  );

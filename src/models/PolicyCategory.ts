import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type PolicyCategoryModel = ModelStatic<any> & { associate?: (models: any) => void };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): PolicyCategoryModel => {
  const PolicyCategory = sequelize.define(
    "PolicyCategory",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },
      businessId: {
        type: dataTypes.UUID,
        allowNull: false,
      },
      parentCategoryId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      name: {
        type: dataTypes.STRING(255),
        allowNull: false,
      },
      key: {
        type: dataTypes.STRING(160),
        allowNull: false,
      },
      description: {
        type: dataTypes.TEXT,
        allowNull: true,
      },
      status: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "active",
      },
      createdByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
      updatedByUserId: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      tableName: "policy_categories",
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ["businessId"] },
        { fields: ["parentCategoryId"] },
        { fields: ["status"] },
      ],
    }
  ) as PolicyCategoryModel;

  PolicyCategory.associate = (models: any) => {
    if (models.Business) {
      PolicyCategory.belongsTo(models.Business, { foreignKey: "businessId" });
    }
    if (models.PolicyCategory) {
      PolicyCategory.belongsTo(models.PolicyCategory, { foreignKey: "parentCategoryId", as: "parentCategory" });
      PolicyCategory.hasMany(models.PolicyCategory, { foreignKey: "parentCategoryId", as: "childCategories" });
    }
    if (models.Policy) {
      PolicyCategory.hasMany(models.Policy, { foreignKey: "categoryId", as: "policies" });
    }
  };

  return PolicyCategory;
};

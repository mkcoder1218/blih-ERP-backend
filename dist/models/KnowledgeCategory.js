"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const KnowledgeCategory = sequelize.define("KnowledgeCategory", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        parentCategoryId: { type: dataTypes.UUID, allowNull: true },
        name: { type: dataTypes.STRING(255), allowNull: false },
        key: { type: dataTypes.STRING(120), allowNull: false },
        description: { type: dataTypes.TEXT, allowNull: true },
        visibility: { type: dataTypes.STRING(50), defaultValue: "company" }, // company, department, private
        status: { type: dataTypes.STRING(50), defaultValue: "active" }
    }, { tableName: "brain_categories", timestamps: true, paranoid: true });
    KnowledgeCategory.associate = (models) => {
        models.KnowledgeCategory.belongsTo(models.Business, { foreignKey: "businessId" });
        models.KnowledgeCategory.belongsTo(models.KnowledgeCategory, { foreignKey: "parentCategoryId", as: "parentCategory" });
        models.KnowledgeCategory.hasMany(models.KnowledgeCategory, { foreignKey: "parentCategoryId", as: "subcategories" });
        models.KnowledgeCategory.hasMany(models.KnowledgeArticle, { foreignKey: "categoryId" });
        models.KnowledgeCategory.hasMany(models.TrainingMaterial, { foreignKey: "categoryId" });
    };
    return KnowledgeCategory;
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const Interaction = sequelize.define("Interaction", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        userId: { type: dataTypes.UUID, allowNull: false },
        leadId: { type: dataTypes.UUID, allowNull: true },
        clientId: { type: dataTypes.UUID, allowNull: true },
        dealId: { type: dataTypes.UUID, allowNull: true },
        type: { type: dataTypes.STRING(50), defaultValue: "note" }, // call, email, meeting, note
        summary: { type: dataTypes.TEXT, allowNull: false },
        nextFollowUpAt: { type: dataTypes.DATE, allowNull: true },
        stageAfterInteraction: { type: dataTypes.STRING(50), allowNull: true },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "crm_interactions", timestamps: true, paranoid: true });
    Interaction.associate = (models) => {
        models.Interaction.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.User)
            models.Interaction.belongsTo(models.User, { foreignKey: "userId" });
        models.Interaction.belongsTo(models.Lead, { foreignKey: "leadId" });
        models.Interaction.belongsTo(models.Client, { foreignKey: "clientId" });
        models.Interaction.belongsTo(models.Deal, { foreignKey: "dealId" });
    };
    return Interaction;
};

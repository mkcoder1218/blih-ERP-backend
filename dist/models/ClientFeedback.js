"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (sequelize, dataTypes) => {
    const ClientFeedback = sequelize.define("ClientFeedback", {
        id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
        businessId: { type: dataTypes.UUID, allowNull: false },
        clientId: { type: dataTypes.UUID, allowNull: false },
        projectId: { type: dataTypes.UUID, allowNull: true },
        submittedByPortalUserId: { type: dataTypes.UUID, allowNull: false },
        rating: { type: dataTypes.INTEGER, allowNull: false },
        npsScore: { type: dataTypes.INTEGER, allowNull: true },
        feedbackType: { type: dataTypes.STRING(50), defaultValue: "general" }, // deliverable, project, support, general
        comments: { type: dataTypes.TEXT, allowNull: true },
        consentForTestimonial: { type: dataTypes.BOOLEAN, defaultValue: false },
        metadata: { type: dataTypes.JSONB, defaultValue: {} }
    }, { tableName: "client_feedbacks", timestamps: true, paranoid: true });
    ClientFeedback.associate = (models) => {
        models.ClientFeedback.belongsTo(models.Business, { foreignKey: "businessId" });
        if (models.Client)
            models.ClientFeedback.belongsTo(models.Client, { foreignKey: "clientId" });
        if (models.Project)
            models.ClientFeedback.belongsTo(models.Project, { foreignKey: "projectId" });
        models.ClientFeedback.belongsTo(models.ClientPortalUser, { foreignKey: "submittedByPortalUserId", as: "submitter" });
    };
    return ClientFeedback;
};

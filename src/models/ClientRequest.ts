
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ClientRequestModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ClientRequestModel => {
  const ClientRequest = sequelize.define("ClientRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: true },
    submittedByPortalUserId: { type: dataTypes.UUID, allowNull: false },
    type: { type: dataTypes.STRING(50), allowNull: false }, // support, change_request, question
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: false },
    status: { type: dataTypes.STRING(50), defaultValue: "open" }, // open, in_progress, resolved, closed
    priority: { type: dataTypes.STRING(50), defaultValue: "medium" }, // low, medium, high, urgent
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "client_requests", timestamps: true, paranoid: true }) as ClientRequestModel;

  ClientRequest.associate = (models: any) => {
    models.ClientRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Client) models.ClientRequest.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Project) models.ClientRequest.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ClientRequest.belongsTo(models.ClientPortalUser, { foreignKey: "submittedByPortalUserId", as: "submitter" });
  };
  return ClientRequest;
};

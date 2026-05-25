
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ClientPortalAccessModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ClientPortalAccessModel => {
  const ClientPortalAccess = sequelize.define("ClientPortalAccess", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    clientPortalUserId: { type: dataTypes.UUID, allowNull: false },
    clientId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: true },
    accessType: { type: dataTypes.STRING(50), defaultValue: "viewer" }, // viewer, editor, approver
    permissions: { type: dataTypes.JSONB, defaultValue: [] },
    expiresAt: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: "active" }
  }, { tableName: "client_portal_accesses", timestamps: true, paranoid: true }) as ClientPortalAccessModel;

  ClientPortalAccess.associate = (models: any) => {
    models.ClientPortalAccess.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ClientPortalAccess.belongsTo(models.ClientPortalUser, { foreignKey: "clientPortalUserId" });
    if(models.Client) models.ClientPortalAccess.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Project) models.ClientPortalAccess.belongsTo(models.Project, { foreignKey: "projectId" });
  };
  return ClientPortalAccess;
};

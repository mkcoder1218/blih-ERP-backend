
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectChangeRequestModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectChangeRequestModel => {
  const ProjectChangeRequest = sequelize.define("ProjectChangeRequest", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    requestedByUserId: { type: dataTypes.UUID, allowNull: false },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: false },
    impactOnCost: { type: dataTypes.FLOAT, defaultValue: 0 },
    impactOnTimeline: { type: dataTypes.INTEGER, defaultValue: 0, comment: 'days' },
    priority: { type: dataTypes.STRING(50), defaultValue: "normal" },
    status: { type: dataTypes.STRING(50), defaultValue: "pending" }, // pending, approved, rejected, implemented
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_change_requests", timestamps: true, paranoid: true }) as ProjectChangeRequestModel;

  ProjectChangeRequest.associate = (models: any) => {
    models.ProjectChangeRequest.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectChangeRequest.belongsTo(models.Project, { foreignKey: "projectId" });
    if(models.User) {
       models.ProjectChangeRequest.belongsTo(models.User, { foreignKey: "requestedByUserId", as: "requester" });
    }
  };
  return ProjectChangeRequest;
};

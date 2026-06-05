import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectMemberModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectMemberModel => {
  const ProjectMember = sequelize.define("ProjectMember", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    projectId: { type: dataTypes.UUID, allowNull: false },
    employeeId: { type: dataTypes.UUID, allowNull: false },
    role: { type: dataTypes.STRING(80), allowNull: false, defaultValue: "MEMBER" },
    allocationPercent: { type: dataTypes.FLOAT, allowNull: false, defaultValue: 100 },
    startDate: { type: dataTypes.DATEONLY, allowNull: true },
    endDate: { type: dataTypes.DATEONLY, allowNull: true },
    status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "active" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "project_members", timestamps: true, paranoid: true }) as ProjectMemberModel;

  ProjectMember.associate = (models: any) => {
    models.ProjectMember.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectMember.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ProjectMember.belongsTo(models.EmployeeRecord, { foreignKey: "employeeId", as: "employee" });
  };

  return ProjectMember;
};

import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectMemberModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectMemberModel => {
  const validateDepartmentScope = async (member: any, options: any) => {
    if (!member.employeeId) return;
    const Project = sequelize.models.Project;
    const EmployeeRecord = sequelize.models.EmployeeRecord;
    if (!Project || !EmployeeRecord) return;

    const project = await Project.findOne({
      where: { id: member.projectId, businessId: member.businessId },
      attributes: ["id", "departmentId"],
      transaction: options?.transaction,
    });
    if (!project) throw new Error("Project not found");
    if (!project.departmentId) return;

    const employee = await EmployeeRecord.findOne({
      where: { id: member.employeeId, businessId: member.businessId },
      attributes: ["id", "departmentId"],
      transaction: options?.transaction,
    });
    if (!employee) throw new Error("Employee not found");
    if (String(employee.departmentId || "") !== String(project.departmentId)) {
      throw new Error("Project member must belong to the project department");
    }
  };

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
  }, {
    tableName: "project_members",
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeValidate: validateDepartmentScope,
      beforeBulkCreate: async (members: any[], options: any) => {
        for (const member of members) await validateDepartmentScope(member, options);
      },
    },
  }) as ProjectMemberModel;

  ProjectMember.associate = (models: any) => {
    models.ProjectMember.belongsTo(models.Business, { foreignKey: "businessId" });
    models.ProjectMember.belongsTo(models.Project, { foreignKey: "projectId" });
    models.ProjectMember.belongsTo(models.EmployeeRecord, { foreignKey: "employeeId", as: "employee" });
  };

  return ProjectMember;
};

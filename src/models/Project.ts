import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProjectModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProjectModel => {
  const Project = sequelize.define("Project", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    departmentId: { type: dataTypes.UUID, allowNull: true },
    clientId: { type: dataTypes.UUID, allowNull: true },
    dealId: { type: dataTypes.UUID, allowNull: true },
    ownerEmployeeId: { type: dataTypes.UUID, allowNull: true },
    managerEmployeeId: { type: dataTypes.UUID, allowNull: true },
    projectManagerUserId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    code: { type: dataTypes.STRING(50), allowNull: true },
    type: { type: dataTypes.STRING(100), defaultValue: "standard" },
    description: { type: dataTypes.TEXT, allowNull: true },
    startDate: { type: dataTypes.DATEONLY, allowNull: true },
    endDate: { type: dataTypes.DATEONLY, allowNull: true },
    budget: { type: dataTypes.FLOAT, defaultValue: 0 },
    currency: { type: dataTypes.STRING(10), defaultValue: "USD" },
    priority: { type: dataTypes.STRING(50), defaultValue: "NORMAL" },
    progressPercent: { type: dataTypes.INTEGER, defaultValue: 0 },
    status: { type: dataTypes.STRING(50), defaultValue: "DRAFT" },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, {
    tableName: "projects",
    timestamps: true,
    paranoid: true,
    hooks: {
      beforeValidate: async (project: any, options: any) => {
        if (project.departmentId === "") project.departmentId = null;
        if (!project.departmentId) return;

        const Department = sequelize.models.Department;
        const EmployeeRecord = sequelize.models.EmployeeRecord;
        if (!Department || !EmployeeRecord) return;

        const department = await Department.findOne({
          where: { id: project.departmentId, businessId: project.businessId },
          transaction: options?.transaction,
        });
        if (!department) throw new Error("Department not found for this business");

        for (const field of ["ownerEmployeeId", "managerEmployeeId"] as const) {
          const employeeId = project[field];
          if (!employeeId) continue;
          const employee = await EmployeeRecord.findOne({
            where: { id: employeeId, businessId: project.businessId },
            attributes: ["id", "departmentId"],
            transaction: options?.transaction,
          });
          if (!employee) throw new Error("Employee not found");
          if (String(employee.departmentId || "") !== String(project.departmentId)) {
            const label = field === "ownerEmployeeId" ? "Project owner" : "Project manager";
            throw new Error(`${label} must belong to the selected project department`);
          }
        }
      },
    },
  }) as ProjectModel;

  Project.associate = (models: any) => {
    models.Project.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.Department) models.Project.belongsTo(models.Department, { foreignKey: "departmentId", as: "department" });
    if(models.User) models.Project.belongsTo(models.User, { foreignKey: "projectManagerUserId", as: "projectManager" });
    if(models.EmployeeRecord) {
      models.Project.belongsTo(models.EmployeeRecord, { foreignKey: "ownerEmployeeId", as: "owner" });
      models.Project.belongsTo(models.EmployeeRecord, { foreignKey: "managerEmployeeId", as: "manager" });
    }
    if(models.Client) models.Project.belongsTo(models.Client, { foreignKey: "clientId" });
    if(models.Deal) models.Project.belongsTo(models.Deal, { foreignKey: "dealId" });
    if(models.ProjectMember) models.Project.hasMany(models.ProjectMember, { foreignKey: "projectId", as: "members" });
    models.Project.hasMany(models.ProjectMilestone, { foreignKey: "projectId" });
    models.Project.hasMany(models.ProjectTask, { foreignKey: "projectId" });
    models.Project.hasMany(models.ProjectIssue, { foreignKey: "projectId" });
    if(models.ProjectActivityLog) models.Project.hasMany(models.ProjectActivityLog, { foreignKey: "projectId", as: "activityLogs" });
  };
  return Project;
};

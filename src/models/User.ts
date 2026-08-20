import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type UserModel = ModelStatic<any> & {
  associate?: (models: any) => void;
};

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): UserModel => {
  const User = sequelize.define(
    "User",
    {
      id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
      businessId: { type: dataTypes.UUID, allowNull: false },
      fullName: { type: dataTypes.STRING(200), allowNull: false },
      email: { type: dataTypes.STRING(320), allowNull: false },
      password: { type: dataTypes.STRING, allowNull: false },
      phone: { type: dataTypes.STRING(50), allowNull: true },
      status: { type: dataTypes.STRING(50), allowNull: false, defaultValue: "active" },
      isPlatformSuperAdmin: { type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      lastLoginAt: { type: dataTypes.DATE, allowNull: true },
      // Self-registration approval workflow
      registrationToken: { type: dataTypes.STRING(128), allowNull: true },
      rejectionReason: { type: dataTypes.TEXT, allowNull: true },
      rejectedAt: { type: dataTypes.DATE, allowNull: true },
      approvedAt: { type: dataTypes.DATE, allowNull: true },
      approvedByUserId: { type: dataTypes.UUID, allowNull: true }
    },
    {
      tableName: "users",
      timestamps: true,
      paranoid: true,
      indexes: [{ unique: true, fields: ["businessId", "email"] }]
    }
  ) as UserModel;

  User.associate = (models: any) => {
    models.User.belongsTo(models.Business, { foreignKey: "businessId" });
    models.User.belongsToMany(models.Role, { through: models.UserRole, foreignKey: "userId" });
    models.User.hasOne(models.BusinessUserProfile, { foreignKey: "userId" });
    models.User.hasMany(models.FileAsset, { foreignKey: "uploadedByUserId", as: "uploadedFiles" });
    models.User.hasMany(models.Notification, { foreignKey: "recipientUserId", as: "receivedNotifications" });
    models.User.hasMany(models.Notification, { foreignKey: "senderUserId", as: "sentNotifications" });
    models.User.hasMany(models.NotificationPreference, { foreignKey: "userId" });
    models.User.hasMany(models.ActivityLog, { foreignKey: "userId" });
    models.User.hasMany(models.DashboardWidget, { foreignKey: "ownerUserId", as: "owner" });
    models.User.hasMany(models.SavedView, { foreignKey: "userId" });
    models.User.hasMany(models.EmployeeRecord, { foreignKey: "userId" });
    models.User.hasMany(models.LeaveBalance, { foreignKey: "userId" });
    models.User.hasMany(models.AttendanceRecord, { foreignKey: "userId" });
    models.User.hasMany(models.Lead, { foreignKey: "assignedToUserId" });
    models.User.hasMany(models.Client, { foreignKey: "accountManagerUserId" });
    models.User.hasMany(models.Deal, { foreignKey: "ownerUserId" });
    models.User.hasMany(models.Interaction, { foreignKey: "userId" });
    models.User.hasMany(models.Project, { foreignKey: "projectManagerUserId", as: "managedProjects" });
    models.User.hasMany(models.ProjectTask, { foreignKey: "assignedToUserId" });
    models.User.hasMany(models.ProjectIssue, { foreignKey: "reportedByUserId", as: "reportedIssues" });
    models.User.hasMany(models.Expense, { foreignKey: "requestedByUserId", as: "submittedExpenses" });
    models.User.hasMany(models.KnowledgeArticle, { foreignKey: "authorUserId", as: "authoredArticles" });
    models.User.hasMany(models.KnowledgeRevision, { foreignKey: "revisedByUserId", as: "articleRevisions" });
    models.User.hasMany(models.Objective, { foreignKey: "ownerUserId", as: "ownedObjectives" });
    models.User.hasMany(models.OKRProgressUpdate, { foreignKey: "updatedByUserId", as: "okrProgressUpdates" });
    models.User.hasMany(models.OKREvaluation, { foreignKey: "evaluatedByUserId", as: "okrEvaluations" });
    models.User.hasMany(models.ClientPortalUser, { foreignKey: "userId", as: "clientPortalLinks" });
    models.User.hasMany(models.ReportRun, { foreignKey: "runByUserId", as: "reportRuns" });
    if (models.UserExemption) {
      models.User.hasMany(models.UserExemption, { foreignKey: "userId", as: "exemptions" });
      models.User.hasMany(models.UserExemption, { foreignKey: "requestedBy", as: "requestedExemptions" });
      models.User.hasMany(models.UserExemption, { foreignKey: "approvedBy", as: "approvedExemptions" });
      models.User.hasMany(models.UserExemption, { foreignKey: "rejectedBy", as: "rejectedExemptions" });
    }
  };

  return User;
};

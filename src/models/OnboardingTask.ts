
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OnboardingTaskModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OnboardingTaskModel => {
  const OnboardingTask = sequelize.define("OnboardingTask", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    assignedToUserId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: true },
    category: { type: dataTypes.STRING(100), defaultValue: 'general' }, // IT, HR, Training
    dueDate: { type: dataTypes.DATE, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: 'pending' }, // pending, in_progress, completed
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_onboarding_tasks", timestamps: true, paranoid: true }) as OnboardingTaskModel;

  OnboardingTask.associate = (models: any) => {
    models.OnboardingTask.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) {
        models.OnboardingTask.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
        models.OnboardingTask.belongsTo(models.User, { foreignKey: "assignedToUserId", as: "assignee" });
    }
  };
  return OnboardingTask;
};

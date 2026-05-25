
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type DisciplinaryCaseModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): DisciplinaryCaseModel => {
  const DisciplinaryCase = sequelize.define("DisciplinaryCase", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    employeeUserId: { type: dataTypes.UUID, allowNull: false },
    reportedByUserId: { type: dataTypes.UUID, allowNull: false },
    caseType: { type: dataTypes.STRING(100), allowNull: false }, // grievance, misconduct, attendance
    severity: { type: dataTypes.STRING(50), defaultValue: 'minor' }, // minor, major, critical
    title: { type: dataTypes.STRING(255), allowNull: false },
    description: { type: dataTypes.TEXT, allowNull: false },
    actionTaken: { type: dataTypes.TEXT, allowNull: true },
    status: { type: dataTypes.STRING(50), defaultValue: 'open' }, // open, under_review, resolved, closed
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "hr_disciplinary_cases", timestamps: true, paranoid: true }) as DisciplinaryCaseModel;

  DisciplinaryCase.associate = (models: any) => {
    models.DisciplinaryCase.belongsTo(models.Business, { foreignKey: "businessId" });
    if(models.User) {
        models.DisciplinaryCase.belongsTo(models.User, { foreignKey: "employeeUserId", as: "employee" });
        models.DisciplinaryCase.belongsTo(models.User, { foreignKey: "reportedByUserId", as: "reporter" });
    }
  };
  return DisciplinaryCase;
};

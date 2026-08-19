import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type OkrCheckInModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): OkrCheckInModel => {
  const OkrCheckIn = sequelize.define("OkrCheckIn", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    keyResultId: { type: dataTypes.UUID, allowNull: false },
    progressValue: { type: dataTypes.FLOAT, allowNull: false }, // currentValue logged at check-in
    date: { type: dataTypes.DATEONLY, allowNull: false },
    note: { type: dataTypes.TEXT, allowNull: true },
    createdById: { type: dataTypes.UUID, allowNull: false }
  }, { tableName: "okr_new_check_ins", timestamps: true }) as OkrCheckInModel;

  OkrCheckIn.associate = (models: any) => {
    models.OkrCheckIn.belongsTo(models.Business, { foreignKey: "businessId" });
    models.OkrCheckIn.belongsTo(models.OkrKeyResult, { foreignKey: "keyResultId" });
    models.OkrCheckIn.belongsTo(models.User, { foreignKey: "createdById", as: "creator" });
  };
  return OkrCheckIn;
};

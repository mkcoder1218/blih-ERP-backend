
import type { DataTypes, ModelStatic, Sequelize } from "sequelize";

export type ProposalModel = ModelStatic<any> & { associate?: (models: any) => void; };

export default (sequelize: Sequelize, dataTypes: typeof DataTypes): ProposalModel => {
  const Proposal = sequelize.define("Proposal", {
    id: { type: dataTypes.UUID, defaultValue: dataTypes.UUIDV4, primaryKey: true },
    businessId: { type: dataTypes.UUID, allowNull: false },
    leadId: { type: dataTypes.UUID, allowNull: true },
    clientId: { type: dataTypes.UUID, allowNull: true },
    dealId: { type: dataTypes.UUID, allowNull: true },
    title: { type: dataTypes.STRING(255), allowNull: false },
    version: { type: dataTypes.INTEGER, defaultValue: 1 },
    value: { type: dataTypes.FLOAT, allowNull: false },
    currency: { type: dataTypes.STRING(10), defaultValue: 'USD' },
    status: { type: dataTypes.STRING(50), defaultValue: 'draft' }, // draft, sent, accepted, rejected
    proposalFileId: { type: dataTypes.UUID, allowNull: true },
    metadata: { type: dataTypes.JSONB, defaultValue: {} }
  }, { tableName: "crm_proposals", timestamps: true, paranoid: true }) as ProposalModel;

  Proposal.associate = (models: any) => {
    models.Proposal.belongsTo(models.Business, { foreignKey: "businessId" });
    models.Proposal.belongsTo(models.Lead, { foreignKey: "leadId" });
    models.Proposal.belongsTo(models.Client, { foreignKey: "clientId" });
    models.Proposal.belongsTo(models.Deal, { foreignKey: "dealId" });
  };
  return Proposal;
};

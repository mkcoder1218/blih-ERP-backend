import { Model, Optional, DataTypes, Sequelize } from 'sequelize';

interface OfferLetterAttributes {
  id: string;
  businessId: string;
  templateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  departmentId: string;
  roleId: string;
  positionId: string;
  salary: string;
  startDate: Date | string;
  employmentType: string;
  workLocation?: string;
  reportingManager?: string;
  status: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  renderedSubject?: string;
  renderedHtml?: string;
  renderedText?: string;
  pdfUrl?: string;
  pdfPath?: string;
  sentAt?: Date;
  acceptedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string;
  createdById: string;
}

interface OfferLetterCreationAttributes extends Optional<OfferLetterAttributes, 'id' | 'status' | 'candidatePhone' | 'workLocation' | 'reportingManager' | 'renderedSubject' | 'renderedHtml' | 'renderedText' | 'pdfUrl' | 'pdfPath' | 'sentAt' | 'acceptedAt' | 'rejectedAt' | 'rejectionReason'> {}

export class OfferLetter extends Model<OfferLetterAttributes, OfferLetterCreationAttributes> implements OfferLetterAttributes {
  public id!: string;
  public businessId!: string;
  public templateId!: string;
  public candidateName!: string;
  public candidateEmail!: string;
  public candidatePhone?: string;
  public departmentId!: string;
  public roleId!: string;
  public positionId!: string;
  public salary!: string;
  public startDate!: Date;
  public employmentType!: string;
  public workLocation?: string;
  public reportingManager?: string;
  public status!: 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED';
  public renderedSubject?: string;
  public renderedHtml?: string;
  public renderedText?: string;
  public pdfUrl?: string;
  public pdfPath?: string;
  public sentAt?: Date;
  public acceptedAt?: Date;
  public rejectedAt?: Date;
  public rejectionReason?: string;
  public createdById!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    OfferLetter.belongsTo(models.Business, { foreignKey: 'businessId' });
    OfferLetter.belongsTo(models.OfferLetterTemplate, { foreignKey: 'templateId' });
    OfferLetter.belongsTo(models.Department, { foreignKey: 'departmentId' });
    OfferLetter.belongsTo(models.Role, { foreignKey: 'roleId' });
    OfferLetter.belongsTo(models.Position, { foreignKey: 'positionId' });
    OfferLetter.belongsTo(models.User, { foreignKey: 'createdById', as: 'Creator' });
  }
}

export default (sequelize: Sequelize, dt: typeof DataTypes) => {
  OfferLetter.init(
    {
      id: {
        type: dt.UUID,
        defaultValue: dt.UUIDV4,
        primaryKey: true,
      },
      businessId: {
        type: dt.UUID,
        allowNull: false,
      },
      templateId: {
        type: dt.UUID,
        allowNull: false,
      },
      candidateName: {
        type: dt.STRING,
        allowNull: false,
      },
      candidateEmail: {
        type: dt.STRING,
        allowNull: false,
      },
      candidatePhone: {
        type: dt.STRING,
        allowNull: true,
      },
      departmentId: {
        type: dt.UUID,
        allowNull: false,
      },
      roleId: {
        type: dt.UUID,
        allowNull: false,
      },
      positionId: {
        type: dt.UUID,
        allowNull: false,
      },
      salary: {
        type: dt.STRING,
        allowNull: false,
      },
      startDate: {
        type: dt.DATEONLY,
        allowNull: false,
      },
      employmentType: {
        type: dt.STRING,
        allowNull: false,
      },
      workLocation: {
        type: dt.STRING,
        allowNull: true,
      },
      reportingManager: {
        type: dt.STRING,
        allowNull: true,
      },
      status: {
        type: dt.ENUM('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED'),
        defaultValue: 'DRAFT',
        allowNull: false,
      },
      renderedSubject: {
        type: dt.STRING,
        allowNull: true,
      },
      renderedHtml: {
        type: dt.TEXT,
        allowNull: true,
      },
      renderedText: {
        type: dt.TEXT,
        allowNull: true,
      },
      pdfUrl: {
        type: dt.STRING,
        allowNull: true,
      },
      pdfPath: {
        type: dt.STRING,
        allowNull: true,
      },
      sentAt: {
        type: dt.DATE,
        allowNull: true,
      },
      acceptedAt: {
        type: dt.DATE,
        allowNull: true,
      },
      rejectedAt: {
        type: dt.DATE,
        allowNull: true,
      },
      rejectionReason: {
        type: dt.TEXT,
        allowNull: true,
      },
      createdById: {
        type: dt.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: 'offer_letters',
    }
  );
  return OfferLetter;
};

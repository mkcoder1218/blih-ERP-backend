import { Model, Optional, DataTypes, Sequelize } from 'sequelize';

interface OfferLetterAttributes {
  id: string;
  businessId: string;
  templateId: string;
  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string;
  departmentId?: string | null;
  roleId?: string | null;
  positionId?: string | null;
  salary?: string | null;
  startDate?: Date | string | null;
  employmentType?: string | null;
  workLocation?: string;
  reportingManager?: string;
  reportingManagerId?: string | null;
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
  onboardingInitialized?: boolean;
  createdById: string;
}

interface OfferLetterCreationAttributes extends Optional<OfferLetterAttributes, 'id' | 'status' | 'candidatePhone' | 'departmentId' | 'roleId' | 'positionId' | 'salary' | 'startDate' | 'employmentType' | 'workLocation' | 'reportingManager' | 'reportingManagerId' | 'renderedSubject' | 'renderedHtml' | 'renderedText' | 'pdfUrl' | 'pdfPath' | 'sentAt' | 'acceptedAt' | 'rejectedAt' | 'rejectionReason' | 'onboardingInitialized'> {}

export class OfferLetter extends Model<OfferLetterAttributes, OfferLetterCreationAttributes> implements OfferLetterAttributes {
  public id!: string;
  public businessId!: string;
  public templateId!: string;
  public candidateName!: string;
  public candidateEmail!: string;
  public candidatePhone?: string;
  public departmentId?: string | null;
  public roleId?: string | null;
  public positionId?: string | null;
  public salary!: string;
  public startDate!: Date;
  public employmentType!: string;
  public workLocation?: string;
  public reportingManager?: string;
  public reportingManagerId?: string | null;
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
        allowNull: true,
      },
      roleId: {
        type: dt.UUID,
        allowNull: true,
      },
      positionId: {
        type: dt.UUID,
        allowNull: true,
      },
      salary: {
        type: dt.STRING,
        allowNull: true,
      },
      startDate: {
        type: dt.DATEONLY,
        allowNull: true,
      },
      employmentType: {
        type: dt.STRING,
        allowNull: true,
      },
      workLocation: {
        type: dt.STRING,
        allowNull: true,
      },
      reportingManager: {
        type: dt.STRING,
        allowNull: true,
      },
      reportingManagerId: {
        type: dt.UUID,
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
      onboardingInitialized: {
        type: dt.BOOLEAN,
        allowNull: false,
        defaultValue: false,
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

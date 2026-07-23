import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from "sequelize";

export const EMPLOYMENT_CONTRACT_STATUSES = [
  "DRAFT",
  "READY",
  "SENT",
  "VIEWED",
  "PARTIALLY_SIGNED",
  "SIGNED",
  "ACTIVE",
  "EXPIRING",
  "EXPIRED",
  "TERMINATED",
  "CANCELLED",
  "SUPERSEDED",
] as const;

export type EmploymentContractStatus =
  (typeof EMPLOYMENT_CONTRACT_STATUSES)[number];

export interface EmploymentContractAttributes {
  id: string;
  businessId: string;
  contractNumber: string;

  templateId?: string | null;
  offerId?: string | null;
  candidateOnboardingId?: string | null;
  employeeRecordId?: string | null;

  candidateName: string;
  candidateEmail: string;
  candidatePhone?: string | null;

  departmentId?: string | null;
  positionId?: string | null;
  reportingManagerId?: string | null;

  contractType: string;
  employmentType?: string | null;
  workLocation?: string | null;

  salary?: string | null;
  currency: string;

  startDate?: Date | string | null;
  endDate?: Date | string | null;
  probationStartDate?: Date | string | null;
  probationEndDate?: Date | string | null;
  noticePeriodDays?: number | null;

  subject: string;

  /**
   * Editable rich-text HTML belonging only to
   * this contract.
   */
  bodyHtml: string;

  /**
   * Plain-text representation of bodyHtml.
   */
  bodyText: string;

  /**
   * Frozen versions created when the contract
   * is sent or signed.
   */
  renderedSubject?: string | null;
  renderedHtml?: string | null;
  renderedText?: string | null;

  status: EmploymentContractStatus;

  pdfPath?: string | null;
  pdfUrl?: string | null;

  sentAt?: Date | null;
  viewedAt?: Date | null;
  employeeSignedAt?: Date | null;
  employerSignedAt?: Date | null;
  activatedAt?: Date | null;
  terminatedAt?: Date | null;
  terminationReason?: string | null;

  metadata: Record<string, unknown>;

  createdById?: string | null;
  updatedById?: string | null;

  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export type EmploymentContractCreationAttributes =
  Optional<
    EmploymentContractAttributes,
    | "id"
    | "templateId"
    | "offerId"
    | "candidateOnboardingId"
    | "employeeRecordId"
    | "candidatePhone"
    | "departmentId"
    | "positionId"
    | "reportingManagerId"
    | "contractType"
    | "employmentType"
    | "workLocation"
    | "salary"
    | "currency"
    | "startDate"
    | "endDate"
    | "probationStartDate"
    | "probationEndDate"
    | "noticePeriodDays"
    | "bodyText"
    | "renderedSubject"
    | "renderedHtml"
    | "renderedText"
    | "status"
    | "pdfPath"
    | "pdfUrl"
    | "sentAt"
    | "viewedAt"
    | "employeeSignedAt"
    | "employerSignedAt"
    | "activatedAt"
    | "terminatedAt"
    | "terminationReason"
    | "metadata"
    | "createdById"
    | "updatedById"
    | "createdAt"
    | "updatedAt"
    | "deletedAt"
  >;

export class EmploymentContract
  extends Model<
    EmploymentContractAttributes,
    EmploymentContractCreationAttributes
  >
  implements EmploymentContractAttributes
{
  declare id: string;
  declare businessId: string;
  declare contractNumber: string;

  declare templateId?: string | null;
  declare offerId?: string | null;
  declare candidateOnboardingId?: string | null;
  declare employeeRecordId?: string | null;

  declare candidateName: string;
  declare candidateEmail: string;
  declare candidatePhone?: string | null;

  declare departmentId?: string | null;
  declare positionId?: string | null;
  declare reportingManagerId?: string | null;

  declare contractType: string;
  declare employmentType?: string | null;
  declare workLocation?: string | null;

  declare salary?: string | null;
  declare currency: string;

  declare startDate?: Date | string | null;
  declare endDate?: Date | string | null;
  declare probationStartDate?: Date | string | null;
  declare probationEndDate?: Date | string | null;
  declare noticePeriodDays?: number | null;

  declare subject: string;
  declare bodyHtml: string;
  declare bodyText: string;

  declare renderedSubject?: string | null;
  declare renderedHtml?: string | null;
  declare renderedText?: string | null;

  declare status: EmploymentContractStatus;

  declare pdfPath?: string | null;
  declare pdfUrl?: string | null;

  declare sentAt?: Date | null;
  declare viewedAt?: Date | null;
  declare employeeSignedAt?: Date | null;
  declare employerSignedAt?: Date | null;
  declare activatedAt?: Date | null;
  declare terminatedAt?: Date | null;
  declare terminationReason?: string | null;

  declare metadata: Record<string, unknown>;

  declare createdById?: string | null;
  declare updatedById?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
  declare readonly deletedAt?: Date | null;

  static associate(models: any) {
    EmploymentContract.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
        as: "business",
      },
    );

    if (models.EmploymentContractTemplate) {
      EmploymentContract.belongsTo(
        models.EmploymentContractTemplate,
        {
          foreignKey: "templateId",
          as: "template",
        },
      );
    }

    if (models.OfferLetter) {
      EmploymentContract.belongsTo(
        models.OfferLetter,
        {
          foreignKey: "offerId",
          as: "offer",
        },
      );
    }

    if (models.CandidateOnboarding) {
      EmploymentContract.belongsTo(
        models.CandidateOnboarding,
        {
          foreignKey: "candidateOnboardingId",
          as: "candidateOnboarding",
        },
      );
    }

    if (models.EmployeeRecord) {
      EmploymentContract.belongsTo(
        models.EmployeeRecord,
        {
          foreignKey: "employeeRecordId",
          as: "employeeRecord",
        },
      );
    }

    if (models.Department) {
      EmploymentContract.belongsTo(
        models.Department,
        {
          foreignKey: "departmentId",
          as: "department",
        },
      );
    }

    if (models.Position) {
      EmploymentContract.belongsTo(
        models.Position,
        {
          foreignKey: "positionId",
          as: "position",
        },
      );
    }

    if (models.User) {
      EmploymentContract.belongsTo(
        models.User,
        {
          foreignKey: "reportingManagerId",
          as: "reportingManager",
        },
      );

      EmploymentContract.belongsTo(
        models.User,
        {
          foreignKey: "createdById",
          as: "creator",
        },
      );

      EmploymentContract.belongsTo(
        models.User,
        {
          foreignKey: "updatedById",
          as: "updater",
        },
      );
    }
  }
}

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
) => {
  EmploymentContract.init(
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        allowNull: false,
        primaryKey: true,
      },

      businessId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      contractNumber: {
        type: dataTypes.STRING(80),
        allowNull: false,
      },

      templateId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      offerId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      candidateOnboardingId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      employeeRecordId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      candidateName: {
        type: dataTypes.STRING(180),
        allowNull: false,
      },

      candidateEmail: {
        type: dataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },

      candidatePhone: {
        type: dataTypes.STRING(60),
        allowNull: true,
      },

      departmentId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      positionId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      reportingManagerId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      contractType: {
        type: dataTypes.STRING(80),
        allowNull: false,
        defaultValue: "PERMANENT",
      },

      employmentType: {
        type: dataTypes.STRING(80),
        allowNull: true,
      },

      workLocation: {
        type: dataTypes.STRING(255),
        allowNull: true,
      },

      salary: {
        type: dataTypes.DECIMAL(18, 2),
        allowNull: true,
      },

      currency: {
        type: dataTypes.STRING(10),
        allowNull: false,
        defaultValue: "ETB",
      },

      startDate: {
        type: dataTypes.DATEONLY,
        allowNull: true,
      },

      endDate: {
        type: dataTypes.DATEONLY,
        allowNull: true,
      },

      probationStartDate: {
        type: dataTypes.DATEONLY,
        allowNull: true,
      },

      probationEndDate: {
        type: dataTypes.DATEONLY,
        allowNull: true,
      },

      noticePeriodDays: {
        type: dataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 0,
        },
      },

      subject: {
        type: dataTypes.STRING(255),
        allowNull: false,
      },

      bodyHtml: {
        type: dataTypes.TEXT,
        allowNull: false,
      },

      bodyText: {
        type: dataTypes.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      renderedSubject: {
        type: dataTypes.STRING(255),
        allowNull: true,
      },

      renderedHtml: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      renderedText: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      status: {
        type: dataTypes.STRING(40),
        allowNull: false,
        defaultValue: "DRAFT",
        validate: {
          isIn: [
            [
              ...EMPLOYMENT_CONTRACT_STATUSES,
            ],
          ],
        },
      },

      pdfPath: {
        type: dataTypes.STRING(1000),
        allowNull: true,
      },

      pdfUrl: {
        type: dataTypes.STRING(1000),
        allowNull: true,
      },

      sentAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      viewedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      employeeSignedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      employerSignedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      activatedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      terminatedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      terminationReason: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      metadata: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      createdById: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      updatedById: {
        type: dataTypes.UUID,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: "employment_contracts",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ["businessId"],
        },
        {
          fields: ["businessId", "status"],
        },
        {
          fields: [
            "businessId",
            "candidateEmail",
          ],
        },
        {
          fields: [
            "businessId",
            "contractNumber",
          ],
          unique: true,
        },
        {
          fields: ["offerId"],
        },
        {
          fields: ["candidateOnboardingId"],
        },
        {
          fields: ["employeeRecordId"],
        },
      ],
    },
  );

  return EmploymentContract;
};

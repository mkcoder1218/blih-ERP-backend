import {
  DataTypes,
  Model,
  Optional,
  Sequelize,
} from "sequelize";

export interface EmploymentContractTemplateAttributes {
  id: string;
  businessId: string;
  name: string;
  description?: string | null;
  contractType: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  variables: string[];
  isDefault: boolean;
  isActive: boolean;
  createdById?: string | null;
  updatedById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export type EmploymentContractTemplateCreationAttributes =
  Optional<
    EmploymentContractTemplateAttributes,
    | "id"
    | "description"
    | "contractType"
    | "bodyText"
    | "variables"
    | "isDefault"
    | "isActive"
    | "createdById"
    | "updatedById"
    | "createdAt"
    | "updatedAt"
  >;

export class EmploymentContractTemplate
  extends Model<
    EmploymentContractTemplateAttributes,
    EmploymentContractTemplateCreationAttributes
  >
  implements EmploymentContractTemplateAttributes
{
  declare id: string;
  declare businessId: string;
  declare name: string;
  declare description?: string | null;
  declare contractType: string;
  declare subject: string;
  declare bodyHtml: string;
  declare bodyText: string;
  declare variables: string[];
  declare isDefault: boolean;
  declare isActive: boolean;
  declare createdById?: string | null;
  declare updatedById?: string | null;

  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;

  static associate(models: any) {
    EmploymentContractTemplate.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
        as: "business",
      },
    );

    EmploymentContractTemplate.belongsTo(
      models.User,
      {
        foreignKey: "createdById",
        as: "creator",
      },
    );

    EmploymentContractTemplate.belongsTo(
      models.User,
      {
        foreignKey: "updatedById",
        as: "updater",
      },
    );

    if (models.EmploymentContract) {
      EmploymentContractTemplate.hasMany(
        models.EmploymentContract,
        {
          foreignKey: "templateId",
          as: "contracts",
        },
      );
    }
  }
}

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
) => {
  EmploymentContractTemplate.init(
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

      name: {
        type: dataTypes.STRING(160),
        allowNull: false,
      },

      description: {
        type: dataTypes.TEXT,
        allowNull: true,
      },

      contractType: {
        type: dataTypes.STRING(80),
        allowNull: false,
        defaultValue: "PERMANENT",
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

      variables: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      isDefault: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      isActive: {
        type: dataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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
      tableName:
        "employment_contract_templates",
      timestamps: true,
      indexes: [
        {
          fields: ["businessId"],
        },
        {
          fields: ["businessId", "isActive"],
        },
        {
          fields: [
            "businessId",
            "contractType",
          ],
        },
      ],
    },
  );

  return EmploymentContractTemplate;
};

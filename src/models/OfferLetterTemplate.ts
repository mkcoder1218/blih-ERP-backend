import { Model, Optional, DataTypes, Sequelize } from "sequelize";

interface OfferLetterTemplateAttributes {
  id: string;
  businessId: string;
  name: string;
  subject: string;
  headerHtml: string | null;
  bodyHtml: string;
  footerHtml: string | null;
  bodyText: string;
  variables: string[];
  isActive: boolean;
  createdById: string;
  updatedById: string;
}

interface OfferLetterTemplateCreationAttributes
  extends Optional<
    OfferLetterTemplateAttributes,
    "id" | "headerHtml" | "footerHtml" | "isActive"
  > {}

export class OfferLetterTemplate
  extends Model<OfferLetterTemplateAttributes, OfferLetterTemplateCreationAttributes>
  implements OfferLetterTemplateAttributes
{
  public id!: string;
  public businessId!: string;
  public name!: string;
  public subject!: string;
  public headerHtml!: string | null;
  public bodyHtml!: string;
  public footerHtml!: string | null;
  public bodyText!: string;
  public variables!: string[];
  public isActive!: boolean;
  public createdById!: string;
  public updatedById!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  static associate(models: any) {
    OfferLetterTemplate.belongsTo(models.Business, { foreignKey: "businessId" });
    OfferLetterTemplate.belongsTo(models.User, {
      foreignKey: "createdById",
      as: "Creator",
    });
    OfferLetterTemplate.belongsTo(models.User, {
      foreignKey: "updatedById",
      as: "Updater",
    });
  }
}

export default (sequelize: Sequelize, dt: typeof DataTypes) => {
  OfferLetterTemplate.init(
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
      name: {
        type: dt.STRING,
        allowNull: false,
      },
      subject: {
        type: dt.STRING,
        allowNull: false,
      },
      headerHtml: {
        type: dt.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      bodyHtml: {
        type: dt.TEXT,
        allowNull: false,
      },
      footerHtml: {
        type: dt.TEXT,
        allowNull: true,
        defaultValue: null,
      },
      bodyText: {
        type: dt.TEXT,
        allowNull: false,
      },
      variables: {
        type: dt.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      isActive: {
        type: dt.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      createdById: {
        type: dt.UUID,
        allowNull: false,
      },
      updatedById: {
        type: dt.UUID,
        allowNull: false,
      },
    },
    {
      sequelize,
      tableName: "offer_letter_templates",
    },
  );
  return OfferLetterTemplate;
};

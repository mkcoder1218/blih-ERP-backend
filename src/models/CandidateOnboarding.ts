import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";

export type CandidateOnboardingModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): CandidateOnboardingModel => {
  const CandidateOnboarding = sequelize.define(
    "CandidateOnboarding",
    {
      id: {
        type: dataTypes.UUID,
        defaultValue: dataTypes.UUIDV4,
        primaryKey: true,
      },

      onboardingId: {
        type: dataTypes.STRING(64),
        allowNull: false,
        unique: true,
      },

      businessId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      /**
       * The accepted recruitment offer that
       * initialized onboarding.
       */
      offerId: {
        type: dataTypes.UUID,
        allowNull: false,
      },

      /**
       * The real employment contract generated
       * separately from the offer.
       */
      contractId: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      candidateEmail: {
        type: dataTypes.STRING,
        allowNull: false,
      },

      candidateName: {
        type: dataTypes.STRING,
        allowNull: false,
      },

      status: {
        type: dataTypes.ENUM(
          "PENDING_CANDIDATE_COMPLETION",
          "IN_PROGRESS",
          "SUBMITTED_FOR_REVIEW",
          "COMPLETED",
          "CANCELLED",
        ),
        allowNull: false,
        defaultValue:
          "PENDING_CANDIDATE_COMPLETION",
      },

      sections: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      resources: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      requiredDocuments: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      requiredPolicies: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      candidateData: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },

      resourceResponses: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: [],
      },

      progress: {
        type: dataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      submittedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      completedAt: {
        type: dataTypes.DATE,
        allowNull: true,
      },

      initializedById: {
        type: dataTypes.UUID,
        allowNull: true,
      },

      metadata: {
        type: dataTypes.JSONB,
        allowNull: false,
        defaultValue: {},
      },
    },
    {
      tableName: "candidate_onboardings",
      timestamps: true,
      paranoid: true,
      indexes: [
        {
          fields: ["businessId"],
        },
        {
          fields: ["offerId"],
        },
        {
          fields: ["contractId"],
        },
        {
          fields: ["candidateEmail"],
        },
        {
          fields: ["status"],
        },
      ],
    },
  ) as CandidateOnboardingModel;

  CandidateOnboarding.associate = (
    models: any,
  ) => {
    CandidateOnboarding.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
        as: "business",
      },
    );

    if (models.OfferLetter) {
      CandidateOnboarding.belongsTo(
        models.OfferLetter,
        {
          foreignKey: "offerId",
          as: "offer",
        },
      );
    }

    if (models.EmploymentContract) {
      CandidateOnboarding.belongsTo(
        models.EmploymentContract,
        {
          foreignKey: "contractId",
          as: "contract",
        },
      );

      CandidateOnboarding.hasOne(
        models.EmploymentContract,
        {
          foreignKey:
            "candidateOnboardingId",
          as: "generatedContract",
        },
      );
    }

    if (models.User) {
      CandidateOnboarding.belongsTo(
        models.User,
        {
          foreignKey: "initializedById",
          as: "initializedBy",
        },
      );
    }
  };

  return CandidateOnboarding;
};

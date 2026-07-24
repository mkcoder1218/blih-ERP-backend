import type {
  DataTypes,
  ModelStatic,
  Sequelize,
} from "sequelize";
import {
  DEFAULT_EMPLOYMENT_STATUS,
  DEFAULT_EMPLOYMENT_TYPE,
} from "../constants/employee.constants";

export type EmployeeRecordModel =
  ModelStatic<any> & {
    associate?: (models: any) => void;
  };

export default (
  sequelize: Sequelize,
  dataTypes: typeof DataTypes,
): EmployeeRecordModel => {
  const EmployeeRecord =
    sequelize.define(
      "EmployeeRecord",
      {
        id: {
          type: dataTypes.UUID,
          defaultValue: dataTypes.UUIDV4,
          primaryKey: true,
        },

        businessId: {
          type: dataTypes.UUID,
          allowNull: false,
        },

        userId: {
          type: dataTypes.UUID,
          allowNull: false,
          unique: true,
        },

        employeeCode: {
          type: dataTypes.STRING(50),
          allowNull: false,
        },

        departmentId: {
          type: dataTypes.UUID,
          allowNull: true,
        },

        positionId: {
          type: dataTypes.UUID,
          allowNull: true,
        },

        managerUserId: {
          type: dataTypes.UUID,
          allowNull: true,
        },

        employmentType: {
          type: dataTypes.STRING(50),
          allowNull: true,
          defaultValue:
            DEFAULT_EMPLOYMENT_TYPE,
        },

        employmentCategory: {
          type: dataTypes.STRING(50),
          allowNull: true,
        },

        assignedStartTime: {
          type: dataTypes.STRING(5),
          allowNull: false,
          defaultValue: "09:00",
        },

        scheduledWorkDays: {
          type: dataTypes.JSONB,
          allowNull: false,
          defaultValue: [
            1,
            2,
            3,
            4,
            5,
          ],
        },

        employmentStatus: {
          type: dataTypes.STRING(50),
          allowNull: false,
          defaultValue:
            DEFAULT_EMPLOYMENT_STATUS,
        },

        hireDate: {
          type: dataTypes.DATE,
          allowNull: false,
        },

        contractStartDate: {
          type: dataTypes.DATE,
          allowNull: true,
        },

        probationEndDate: {
          type: dataTypes.DATE,
          allowNull: true,
        },

        probationCompletedAt: {
          type: dataTypes.DATE,
          allowNull: true,
        },

        completionEmailSentAt: {
          type: dataTypes.DATE,
          allowNull: true,
        },

        contractEndDate: {
          type: dataTypes.DATE,
          allowNull: true,
        },

        salaryInfo: {
          type: dataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },

        emergencyContact: {
          type: dataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },

        metadata: {
          type: dataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
      },
      {
        tableName:
          "hr_employee_records",
        timestamps: true,
        paranoid: true,
      },
    ) as EmployeeRecordModel;

  EmployeeRecord.associate = (
    models: any,
  ) => {
    EmployeeRecord.belongsTo(
      models.Business,
      {
        foreignKey: "businessId",
      },
    );

    if (models.User) {
      EmployeeRecord.belongsTo(
        models.User,
        {
          foreignKey: "userId",
          as: "user",
        },
      );

      EmployeeRecord.belongsTo(
        models.User,
        {
          foreignKey:
            "managerUserId",
          as: "manager",
        },
      );
    }

    if (models.Department) {
      EmployeeRecord.belongsTo(
        models.Department,
        {
          foreignKey:
            "departmentId",
          as: "department",
        },
      );
    }

    if (models.Position) {
      EmployeeRecord.belongsTo(
        models.Position,
        {
          foreignKey: "positionId",
          as: "position",
        },
      );
    }

    if (
      models.EmployeeProbation
    ) {
      EmployeeRecord.hasMany(
        models.EmployeeProbation,
        {
          foreignKey:
            "employeeRecordId",
          as: "probations",
        },
      );
    }
  };

  return EmployeeRecord;
};

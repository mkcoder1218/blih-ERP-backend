import { db } from "../../models";
import { TesterAccount } from "./tester.models";

export async function normalizeStandardTesterSimulation(
  userId: string,
  transaction?: any,
) {
  const tester = await TesterAccount.findOne({
    where: { userId },
    ...(transaction ? { transaction } : {}),
  });

  if (!tester || String(tester.testerLevel) !== "STANDARD") {
    return;
  }

  await db.BusinessUserProfile.update(
    {
      employmentType: "full_time",
      status: "active",
    },
    {
      where: { userId },
      ...(transaction ? { transaction } : {}),
    },
  );

  const employee = await db.EmployeeRecord.findOne({
    where: { userId },
    ...(transaction ? { transaction } : {}),
  });

  if (!employee) {
    return;
  }

  await employee.update(
    {
      employmentType: "full_time",
      employmentCategory: null,
      employmentStatus: "active",
      metadata: {
        ...(employee.metadata || {}),
        isTestAccount: true,
        excludeFromReporting: true,
        simulatedAsRealEmployee: true,
      },
    },
    ...(transaction ? { transaction } : {}),
  );
}

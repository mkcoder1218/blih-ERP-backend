import type { JobDefinition } from "../runner";
import { EmploymentChangeService } from "../../modules/employmentChange/employmentChange.service";

const service = new EmploymentChangeService();

export const employmentChangeEffectiveDate: JobDefinition = {
  name: "employment-change-effective-date",
  type: "hr",
  cronExpression: "15 0 * * *",
  handler: async () => {
    const result = await service.applyDueChanges();
    console.log(
      `[EmploymentChangeEffectiveDate] scanned=${result.scanned} applied=${result.applied} failed=${result.failed.length}`,
    );
  },
};

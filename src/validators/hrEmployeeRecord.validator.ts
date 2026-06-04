import Joi from "joi";
import { EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES } from "../constants/employee.constants";

const accountSchema = Joi.object({
  firstName: Joi.string().max(100).allow("", null).optional(),
  lastName: Joi.string().max(100).allow("", null).optional(),
  email: Joi.string().email().max(320).allow("", null).optional(),
  phone: Joi.string().max(50).allow("", null).optional(),
  password: Joi.string().min(6).max(255).allow("", null).optional(),
}).min(1);

const profileSchema = Joi.object({
  employeeCode: Joi.string().max(50).allow("", null).optional(),
  systemRole: Joi.string().max(50).allow("", null).optional(),
  departmentId: Joi.string().uuid().allow("", null).optional(),
  positionId: Joi.string().uuid().allow("", null).optional(),
  reportingTo: Joi.string().uuid().allow("", null).optional(),
  startDate: Joi.date().iso().allow("", null).optional(),
  contractStartDate: Joi.date().iso().allow("", null).optional(),
  contractEndDate: Joi.date().iso().allow("", null).optional(),
  monthlySalary: Joi.alternatives(Joi.number(), Joi.string()).allow("", null).optional(),
  salaryCurrency: Joi.string().max(10).allow("", null).optional(),
  probationPeriod: Joi.alternatives(Joi.number(), Joi.string()).allow("", null).optional(),
  employmentType: Joi.string().valid(...EMPLOYMENT_TYPES).allow("", null).optional(),
  employmentStatus: Joi.string().valid(...EMPLOYMENT_STATUSES).allow("", null).optional(),
  additionalNotes: Joi.string().allow("", null).optional(),

  dateOfBirth: Joi.date().iso().allow("", null).optional(),
  city: Joi.string().max(100).allow("", null).optional(),
  countryOfBirth: Joi.string().max(100).allow("", null).optional(),
  additionalPhone: Joi.string().max(50).allow("", null).optional(),
  branch: Joi.string().max(120).allow("", null).optional(),

  bankDetails: Joi.array()
    .items(
      Joi.object({
        bankName: Joi.string().max(120).allow("", null).optional(),
        accountNumber: Joi.string().max(120).allow("", null).optional(),
      })
    )
    .optional(),

  assetsAndCredentials: Joi.array().items(Joi.any()).optional(),

  emergencyFirstName: Joi.string().max(100).allow("", null).optional(),
  emergencyLastName: Joi.string().max(100).allow("", null).optional(),
  emergencyPhone: Joi.string().max(50).allow("", null).optional(),
  emergencyEmail: Joi.string().email().max(320).allow("", null).optional(),
  emergencyCity: Joi.string().max(100).allow("", null).optional(),
  emergencyCountry: Joi.string().max(100).allow("", null).optional(),
}).min(1);

export const updateEmployeeRecordSchema = Joi.object({
  account: accountSchema.optional(),
  profile: profileSchema.optional(),
  uploads: Joi.object().unknown(true).optional(),
  offerLetterTemplateId: Joi.string().uuid().allow("", null).optional(),
}).min(1);

export const createEmployeeRecordSchema = Joi.object({
  account: accountSchema.keys({
    firstName: Joi.string().max(100).required(),
    lastName: Joi.string().max(100).required(),
    email: Joi.string().email().max(320).required(),
    password: Joi.string().min(6).max(255).required(),
    phone: Joi.string().max(50).allow("", null).optional(),
  }).required(),
  profile: profileSchema.optional(),
  uploads: Joi.object().unknown(true).optional(),
  offerLetterTemplateId: Joi.string().uuid().allow("", null).optional(),
});

export const bulkEmployeeRowsSchema = Joi.object({
  rows: Joi.array().items(Joi.object().unknown(true)).min(1).required(),
});

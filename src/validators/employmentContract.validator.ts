import Joi from "joi";
import {
  EMPLOYMENT_CONTRACT_STATUSES,
} from "../models/EmploymentContract";

const nullableUuid = Joi.string()
  .uuid()
  .allow(null, "");

const nullableDate = Joi.date()
  .iso()
  .allow(null, "");

const nullableText = Joi.string()
  .trim()
  .allow(null, "");

const contractTypeSchema =
  Joi.string()
    .trim()
    .uppercase()
    .max(80);

export const employmentContractTemplateCreateSchema =
  Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(160)
      .required(),

    description:
      nullableText.max(2000),

    contractType:
      contractTypeSchema
        .default("PERMANENT"),

    subject: Joi.string()
      .trim()
      .min(2)
      .max(255)
      .required(),

    bodyHtml: Joi.string()
      .min(1)
      .required(),

    bodyText: Joi.string()
      .allow("")
      .default(""),

    variables: Joi.array()
      .items(
        Joi.string()
          .trim()
          .max(100),
      )
      .default([]),

    isDefault:
      Joi.boolean()
        .default(false),

    isActive:
      Joi.boolean()
        .default(true),
  });

export const employmentContractTemplateUpdateSchema =
  Joi.object({
    name: Joi.string()
      .trim()
      .min(2)
      .max(160),

    description:
      nullableText.max(2000),

    contractType:
      contractTypeSchema,

    subject: Joi.string()
      .trim()
      .min(2)
      .max(255),

    bodyHtml:
      Joi.string()
        .min(1),

    bodyText:
      Joi.string()
        .allow(""),

    variables: Joi.array()
      .items(
        Joi.string()
          .trim()
          .max(100),
      ),

    isDefault:
      Joi.boolean(),

    isActive:
      Joi.boolean(),
  }).min(1);

export const employmentContractCreateSchema =
  Joi.object({
    templateId:
      nullableUuid,

    offerId:
      nullableUuid,

    candidateOnboardingId:
      nullableUuid,

    employeeRecordId:
      nullableUuid,

    candidateName:
      Joi.string()
        .trim()
        .min(2)
        .max(180)
        .required(),

    candidateEmail:
      Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(255)
        .required(),

    candidatePhone:
      nullableText.max(60),

    departmentId:
      nullableUuid,

    positionId:
      nullableUuid,

    reportingManagerId:
      nullableUuid,

    contractType:
      contractTypeSchema
        .default("PERMANENT"),

    employmentType:
      nullableText.max(80),

    workLocation:
      nullableText.max(255),

    salary:
      Joi.alternatives()
        .try(
          Joi.number()
            .precision(2)
            .min(0),

          Joi.string()
            .trim()
            .pattern(
              /^\d+(\.\d{1,2})?$/,
            ),
        )
        .allow(null, ""),

    currency:
      Joi.string()
        .trim()
        .uppercase()
        .min(3)
        .max(10)
        .default("ETB"),

    startDate:
      nullableDate,

    endDate:
      nullableDate,

    probationStartDate:
      nullableDate,

    probationEndDate:
      nullableDate,

    noticePeriodDays:
      Joi.number()
        .integer()
        .min(0)
        .max(3650)
        .allow(null, ""),

    subject:
      Joi.string()
        .trim()
        .min(2)
        .max(255)
        .required(),

    bodyHtml:
      Joi.string()
        .min(1)
        .required(),

    bodyText:
      Joi.string()
        .allow("")
        .default(""),

    metadata:
      Joi.object()
        .unknown(true)
        .default({}),
  });

export const employmentContractUpdateSchema =
  Joi.object({
    templateId:
      nullableUuid,

    candidateOnboardingId:
      nullableUuid,

    employeeRecordId:
      nullableUuid,

    candidateName:
      Joi.string()
        .trim()
        .min(2)
        .max(180),

    candidateEmail:
      Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(255),

    candidatePhone:
      nullableText.max(60),

    departmentId:
      nullableUuid,

    positionId:
      nullableUuid,

    reportingManagerId:
      nullableUuid,

    contractType:
      contractTypeSchema,

    employmentType:
      nullableText.max(80),

    workLocation:
      nullableText.max(255),

    salary:
      Joi.alternatives()
        .try(
          Joi.number()
            .precision(2)
            .min(0),

          Joi.string()
            .trim()
            .pattern(
              /^\d+(\.\d{1,2})?$/,
            ),
        )
        .allow(null, ""),

    currency:
      Joi.string()
        .trim()
        .uppercase()
        .min(3)
        .max(10),

    startDate:
      nullableDate,

    endDate:
      nullableDate,

    probationStartDate:
      nullableDate,

    probationEndDate:
      nullableDate,

    noticePeriodDays:
      Joi.number()
        .integer()
        .min(0)
        .max(3650)
        .allow(null, ""),

    subject:
      Joi.string()
        .trim()
        .min(2)
        .max(255),

    bodyHtml:
      Joi.string()
        .min(1),

    bodyText:
      Joi.string()
        .allow(""),

    metadata:
      Joi.object()
        .unknown(true),
  }).min(1);

export const employmentContractPreviewSchema =
  Joi.object({
    subject:
      Joi.string()
        .allow("")
        .default(""),

    bodyHtml:
      Joi.string()
        .allow("")
        .required(),

    bodyText:
      Joi.string()
        .allow("")
        .default(""),

    data:
      Joi.object()
        .unknown(true)
        .default({}),
  });

export const employmentContractFromOfferSchema =
  Joi.object({
    templateId:
      Joi.string()
        .uuid()
        .required(),

    candidateOnboardingId:
      nullableUuid,

    contractType:
      contractTypeSchema
        .default("PERMANENT"),

    endDate:
      nullableDate,

    probationStartDate:
      nullableDate,

    probationEndDate:
      nullableDate,

    noticePeriodDays:
      Joi.number()
        .integer()
        .min(0)
        .max(3650)
        .allow(null, ""),

    subject:
      Joi.string()
        .trim()
        .min(2)
        .max(255),

    bodyHtml:
      Joi.string()
        .min(1),

    bodyText:
      Joi.string()
        .allow(""),

    metadata:
      Joi.object()
        .unknown(true)
        .default({}),
  });

export const employmentContractListQuerySchema =
  Joi.object({
    status:
      Joi.string()
        .uppercase()
        .valid(
          ...EMPLOYMENT_CONTRACT_STATUSES,
        ),

    search:
      Joi.string()
        .trim()
        .allow("")
        .max(200),

    offerId:
      nullableUuid,

    employeeRecordId:
      nullableUuid,

    limit:
      Joi.number()
        .integer()
        .min(1)
        .max(100)
        .default(20),

    offset:
      Joi.number()
        .integer()
        .min(0)
        .default(0),
  });
export const employmentContractAssignSchema =
  Joi.object({
    templateId:
      Joi.string()
        .uuid()
        .required(),

    candidateName:
      Joi.string()
        .trim()
        .min(2)
        .max(180)
        .allow(""),

    candidateEmail:
      Joi.string()
        .trim()
        .lowercase()
        .email()
        .max(255)
        .allow(""),

    candidatePhone:
      nullableText.max(60),

    departmentId:
      nullableUuid,

    departmentName:
      nullableText.max(200),

    positionId:
      nullableUuid,

    positionName:
      nullableText.max(200),

    reportingManagerId:
      nullableUuid,

    managerName:
      nullableText.max(200),

    contractType:
      contractTypeSchema
        .default("PERMANENT"),

    employmentType:
      nullableText.max(80),

    workLocation:
      nullableText.max(255),

    salary:
      Joi.alternatives()
        .try(
          Joi.number()
            .precision(2)
            .min(0),

          Joi.string()
            .trim()
            .pattern(
              /^\d+(\.\d{1,2})?$/,
            ),
        )
        .allow(null, ""),

    currency:
      Joi.string()
        .trim()
        .uppercase()
        .min(3)
        .max(10)
        .default("ETB"),

    startDate:
      nullableDate,

    endDate:
      nullableDate,

    probationStartDate:
      nullableDate,

    probationEndDate:
      nullableDate,

    noticePeriodDays:
      Joi.number()
        .integer()
        .min(0)
        .max(3650)
        .allow(null, ""),

    companyName:
      Joi.string()
        .trim()
        .max(200)
        .allow(""),

    companyAddress:
      Joi.string()
        .trim()
        .max(1000)
        .allow(""),

    subject:
      Joi.string()
        .trim()
        .max(255)
        .allow(""),

    bodyHtml:
      Joi.string()
        .allow(""),

    bodyText:
      Joi.string()
        .allow(""),

    metadata:
      Joi.object()
        .unknown(true)
        .default({}),
  });

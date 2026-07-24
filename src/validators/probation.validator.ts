import Joi from "joi";
import {
  EMPLOYEE_PROBATION_SOURCES,
  EMPLOYEE_PROBATION_STATUSES,
} from "../models/EmployeeProbation";

const competencySchema = Joi.object({
  name: Joi.string()
    .trim()
    .max(160)
    .required(),

  description: Joi.string()
    .trim()
    .allow("", null)
    .optional(),

  weight: Joi.number()
    .min(0.01)
    .max(100)
    .precision(2)
    .required(),

  isRequired: Joi.boolean().default(true),

  sortOrder: Joi.number()
    .integer()
    .min(0)
    .default(0),

  isActive: Joi.boolean().default(true),
});

export const replacePositionCompetenciesSchema =
  Joi.object({
    competencies: Joi.array()
      .items(competencySchema)
      .min(1)
      .required(),
  });

export const initializeProbationSchema =
  Joi.object({
    employeeUserId: Joi.string()
      .uuid()
      .required(),

    startDate: Joi.date()
      .iso()
      .required(),

    durationMonths: Joi.number()
      .integer()
      .min(1)
      .max(36)
      .required(),

    expectedEndDate: Joi.date()
      .iso()
      .optional(),

    managerUserId: Joi.string()
      .uuid()
      .optional(),

    finalApproverUserId: Joi.string()
      .uuid()
      .allow(null, "")
      .optional(),

    source: Joi.string()
      .valid(...EMPLOYEE_PROBATION_SOURCES)
      .required(),

    status: Joi.string()
      .valid(...EMPLOYEE_PROBATION_STATUSES)
      .default("ACTIVE"),

    notes: Joi.string()
      .trim()
      .allow("", null)
      .max(5000)
      .optional(),

    metadata: Joi.object()
      .unknown(true)
      .default({}),
  });

export const listProbationsQuerySchema =
  Joi.object({
    page: Joi.number()
      .integer()
      .min(1)
      .default(1),

    size: Joi.number()
      .integer()
      .min(1)
      .max(100)
      .default(20),

    search: Joi.string()
      .trim()
      .allow("")
      .optional(),

    status: Joi.string()
      .valid(...EMPLOYEE_PROBATION_STATUSES)
      .optional(),

    employeeUserId: Joi.string()
      .uuid()
      .optional(),

    managerUserId: Joi.string()
      .uuid()
      .optional(),

    departmentId: Joi.string()
      .uuid()
      .optional(),

    positionId: Joi.string()
      .uuid()
      .optional(),

    endingFrom: Joi.date()
      .iso()
      .optional(),

    endingTo: Joi.date()
      .iso()
      .optional(),
  });

const probationDecisionSchema = Joi.string().valid(
  "CONFIRM_EMPLOYMENT",
  "EXTEND_PROBATION",
  "TERMINATE_EMPLOYMENT",
  "REQUEST_MORE_INFORMATION",
);

const criterionScoreSchema = Joi.object({
  criterionId: Joi.string().uuid().required(),
  score: Joi.number().min(0).max(100).precision(2).required(),
  comment: Joi.string().trim().allow("", null).max(3000).optional(),
});

export const probationReviewSchema = Joi.object({
  recommendation: probationDecisionSchema.required(),
  comments: Joi.string().trim().allow("", null).max(5000).optional(),
  scores: Joi.array().items(criterionScoreSchema).min(1).required(),
});

export const probationFinalDecisionSchema = Joi.object({
  decision: Joi.string().valid(
    "CONFIRM_EMPLOYMENT",
    "EXTEND_PROBATION",
    "TERMINATE_EMPLOYMENT",
  ).required(),
  comments: Joi.string().trim().allow("", null).max(5000).optional(),
  extensionMonths: Joi.when("decision", {
    is: "EXTEND_PROBATION",
    then: Joi.number().integer().min(1).max(12).required(),
    otherwise: Joi.number().integer().min(1).max(12).optional(),
  }),
  newExpectedEndDate: Joi.date().iso().optional(),
});

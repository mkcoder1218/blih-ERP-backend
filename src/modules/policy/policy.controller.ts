import type { Request, Response } from "express";
import { Op } from "sequelize";
import { env } from "../../config/env";
import { db } from "../../models";
import { errorResponse, successResponse } from "../../utils/response";

const publicPolicyAttributes = [
  "id",
  "policyType",
  "title",
  "slug",
  "version",
  "isRequired",
  "publishedAt",
  "contentHtml",
  "contentJson",
  "contentText",
];

function serializePolicy(policy: any) {
  const json = policy.toJSON ? policy.toJSON() : policy;
  const { id, ...rest } = json;
  return { _id: id, ...rest };
}

export class PolicyController {
  getGuestPolicy = async (req: Request, res: Response) => {
    if (!env.guestApiKey) {
      return errorResponse(res, "GUEST_API_KEY not configured on the server", 503);
    }

    const apiKey = req.header("x-api-key");
    if (!apiKey) {
      return errorResponse(res, "Missing x-api-key header", 401);
    }
    if (apiKey !== env.guestApiKey) {
      return errorResponse(res, "Invalid API key", 403);
    }

    const policy = await db.Policy.findOne({
      where: {
        policyType: req.params.policyType,
        status: "active",
      },
      attributes: publicPolicyAttributes,
      order: [["version", "DESC"], ["publishedAt", "DESC"], ["createdAt", "DESC"]],
    });

    if (!policy) {
      return errorResponse(res, "Policy type not found or not active", 404);
    }

    successResponse(res, serializePolicy(policy), "Policy fetched");
  };

  listPublicPolicies = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const businessId = req.user!.businessId;

    const policies = await db.Policy.findAll({
      where: {
        status: "active",
        [Op.or]: [{ businessId }, { businessId: null }],
      },
      attributes: publicPolicyAttributes,
      order: [["policyType", "ASC"], ["version", "DESC"], ["publishedAt", "DESC"]],
    });

    const acceptances = await db.PolicyAcceptance.findAll({
      where: {
        userId,
        policyId: policies.map((policy: any) => policy.id),
      },
      attributes: ["policyId", "policyVersion", "acceptedAt"],
    });
    const acceptanceByPolicyId = new Map<string, any>(
      acceptances.map((acceptance: any) => [acceptance.policyId, acceptance])
    );

    const data = policies.map((policy: any) => {
      const acceptance = acceptanceByPolicyId.get(policy.id);
      return {
        ...serializePolicy(policy),
        acceptance: acceptance
          ? {
              accepted: acceptance.policyVersion >= policy.version,
              acceptedAt: acceptance.acceptedAt,
              policyVersion: acceptance.policyVersion,
            }
          : {
              accepted: false,
              acceptedAt: null,
              policyVersion: null,
            },
      };
    });

    successResponse(res, data, "Policies fetched");
  };

  acceptPolicy = async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const businessId = req.user!.businessId;
    const policy = await db.Policy.findOne({
      where: {
        id: req.params.id,
        status: "active",
        [Op.or]: [{ businessId }, { businessId: null }],
      },
    });

    if (!policy) {
      return errorResponse(res, "Policy not found or not active", 404);
    }

    const [acceptance, created] = await db.PolicyAcceptance.findOrCreate({
      where: { policyId: policy.id, userId },
      defaults: {
        policyId: policy.id,
        userId,
        businessId,
        policyVersion: policy.version,
        acceptedAt: new Date(),
        metadata: {
          ip: req.ip,
          userAgent: req.header("user-agent") || null,
        },
      },
    });

    let acceptedAt = acceptance.acceptedAt;

    if (!created && acceptance.policyVersion < policy.version) {
      acceptedAt = new Date();
      await acceptance.update({
        businessId,
        policyVersion: policy.version,
        acceptedAt,
        metadata: {
          ip: req.ip,
          userAgent: req.header("user-agent") || null,
        },
      });
    }

    if (created) {
      await policy.increment("acceptanceCount");
    }

    successResponse(
      res,
      {
        policyId: policy.id,
        accepted: true,
        acceptedAt,
        policyVersion: policy.version,
      },
      "Policy accepted",
      created ? 201 : 200
    );
  };
}

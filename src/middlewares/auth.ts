import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { db } from "../models";
import type { AccessTokenPayload } from "../types/jwt";
import { TERMINATED_EMPLOYMENT_STATUS } from "../constants/employee.constants";
import { TesterAccount } from "../modules/tester/tester.models";
import {
  testerMutationBlockedInProduction,
  testerSafetyMessage,
} from "../modules/tester/tester.safety";

function parseBearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) return null;
  return token;
}

function normalizedRequestPath(req: Request) {
  return String(req.originalUrl || req.url || "")
    .split("?")[0]
    .replace(/\/+$/, "");
}

export async function authRequired(req: Request, res: Response, next: NextFunction) {
  try {
    const token = parseBearer(req);
    if (!token) return next({ statusCode: 401, message: "Missing access token" });

    const decoded = jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload & { sub?: string };

    const user = await db.User.findByPk(decoded.sub, {
      include: [
        {
          model: db.Role,
          through: { attributes: [] },
          include: [{ model: db.Permission, through: { attributes: [] } }]
        }
      ]
    });

    if (!user) return next({ statusCode: 401, message: "Invalid user" });
    if (user.deletedAt) return next({ statusCode: 401, message: "User deleted" });
    if (user.status !== "active") return next({ statusCode: 403, message: "User is not active" });

    const employeeRecord = await db.EmployeeRecord.findOne({
      where: { businessId: user.businessId, userId: user.id },
      attributes: ["employmentStatus"],
    });
    if (employeeRecord?.employmentStatus === TERMINATED_EMPLOYMENT_STATUS) {
      return next({ statusCode: 403, message: "Employee has left the company" });
    }

    const tester = user.isTestAccount
      ? await TesterAccount.findOne({ where: { userId: user.id } })
      : null;
    const testerLevel = tester ? String(tester.testerLevel) : null;
    const isMasterTester = testerLevel === "MASTER";
    const testerSafetyMode = tester ? String(tester.safetyMode || "RESTRICTED") : null;

    const roles = (user.Roles || []).map((r: any) => r.key);
    const permissions = new Set<string>();
    (user.Roles || []).forEach((r: any) => {
      (r.Permissions || []).forEach((p: any) => permissions.add(p.key));
    });
    [
      "attendance.self",
      "profiles.self",
      "performance.self",
      "project.self",
      "project.task",
      "career.self",
      "career.request",
    ].forEach((key) => permissions.add(key));

    /**
     * Job-request permission compatibility.
     *
     * Recruitment originally authorized new hiring requests by the literal
     * DEPARTMENT_HEAD / DEPT_HEAD role key. Custom roles therefore could not
     * submit a hiring request even when the business intended them to do so.
     *
     * `job.request` is now the explicit capability. The aliases below are
     * deliberately request-scoped so they only bridge the legacy recruitment
     * guards and do not grant Department Head authority anywhere else.
     */
    const requestPath = normalizedRequestPath(req);
    const requestScopedRoles = [...roles];
    const hasJobRequestPermission = permissions.has("job.request");

    if (hasJobRequestPermission) {
      const isJobOpeningCollection = requestPath.endsWith("/hr/recruitment/job-openings");
      const isJobRequestCollection = requestPath.endsWith("/hr/recruitment/job-requests");
      const isTemplateCollection = requestPath.endsWith("/hr/recruitment/templates");

      if (
        req.method === "POST" &&
        isJobOpeningCollection &&
        !requestScopedRoles.includes("DEPARTMENT_HEAD") &&
        !requestScopedRoles.includes("DEPT_HEAD")
      ) {
        requestScopedRoles.push("DEPARTMENT_HEAD");
      }

      if (req.method === "GET" && isJobRequestCollection) {
        permissions.add("job.read");
      }

      if (req.method === "GET" && isTemplateCollection) {
        permissions.add("job_template.read");
      }
    }

    // Master Tester authority is stored separately from normal RBAC. We expose
    // an effective super-admin bit in request context only so legacy guards that
    // already understand super-admin bypasses keep working without assigning a
    // real PLATFORM_SUPER_ADMIN role to the tester user.
    const effectiveSuperAdmin =
      Boolean(user.isPlatformSuperAdmin) ||
      roles.includes("PLATFORM_SUPER_ADMIN") ||
      isMasterTester;

    req.user = {
      id: user.id,
      businessId: user.businessId,
      email: user.email,
      fullName: user.fullName,
      isPlatformSuperAdmin: effectiveSuperAdmin,
      isTestAccount: Boolean(user.isTestAccount && tester),
      testerLevel: testerLevel === "MASTER" || testerLevel === "STANDARD" ? testerLevel : null,
      isMasterTester,
      testerSafetyMode:
        testerSafetyMode === "FULL" || testerSafetyMode === "RESTRICTED"
          ? testerSafetyMode
          : null,
      roles: requestScopedRoles,
      permissions: Array.from(permissions)
    };

    if (testerMutationBlockedInProduction(req)) {
      return next({ statusCode: 403, message: testerSafetyMessage() });
    }

    next();
  } catch {
    next({ statusCode: 401, message: "Invalid or expired token" });
  }
}

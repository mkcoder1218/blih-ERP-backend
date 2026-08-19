import type { Request } from "express";
import { env } from "../../config/env";

function normalizedPath(req: Request) {
  return `${req.baseUrl || ""}${req.path || ""}`.toLowerCase();
}

export function testerMutationBlockedInProduction(req: Request) {
  if (env.nodeEnv !== "production") return false;
  if (!req.user?.isTestAccount) return false;
  if (req.user.testerSafetyMode !== "RESTRICTED") return false;

  const method = String(req.method || "GET").toUpperCase();
  const path = normalizedPath(req);

  if (["GET", "HEAD", "OPTIONS"].includes(method)) return false;

  // Master Tester must be able to administer tester accounts even in production.
  if (req.user.isMasterTester && path.includes("/tester-control")) return false;

  // Destructive deletes are always blocked for production tester identities.
  if (method === "DELETE") return true;

  const highRiskPatterns = [
    /\/purge(?:\/|$)/,
    /\/terminate(?:\/|$)/,
    /\/termination(?:\/|$)/,
    /\/payroll[^/]*\/(?:run|execute|finalize|post|pay)(?:\/|$)/,
    /\/payments?\/(?:execute|capture|refund|void|delete)(?:\/|$)/,
    /\/subscription[^/]*\/(?:cancel|delete|purge|charge)(?:\/|$)/,
    /\/admin-ops\//,
  ];

  return highRiskPatterns.some((pattern) => pattern.test(path));
}

export function testerSafetyMessage() {
  return "This destructive production action is blocked for TEST ACCOUNT identities. Use staging/dev or a normal authorized account for irreversible production operations.";
}

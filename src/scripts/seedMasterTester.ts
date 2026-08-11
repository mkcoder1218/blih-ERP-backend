import crypto from "crypto";
import { db } from "../models";
import { TesterService } from "../modules/tester/tester.service";

function generatedPassword() {
  const value = crypto.randomBytes(18).toString("base64url");
  return `Blih!${value.slice(0, 8)}-${value.slice(8, 16)}-${value.slice(16, 24)}`;
}

async function main() {
  const service = new TesterService();

  const businessIdFromEnv = String(process.env.MASTER_TESTER_BUSINESS_ID || "").trim();
  const business = businessIdFromEnv
    ? await db.Business.findOne({ where: { id: businessIdFromEnv, status: "active" } })
    : await db.Business.findOne({
        where: { status: "active" },
        order: [["createdAt", "ASC"]],
      });

  if (!business) {
    throw new Error(
      "No active business exists. Create a business first or set MASTER_TESTER_BUSINESS_ID.",
    );
  }

  const fullName = String(process.env.MASTER_TESTER_NAME || "Blih Master Tester").trim();
  const email = String(process.env.MASTER_TESTER_EMAIL || "master.tester@blih.local").trim();
  const suppliedPassword = String(process.env.MASTER_TESTER_PASSWORD || "").trim();
  const password = suppliedPassword || generatedPassword();

  const tester = await service.bootstrapMaster({
    fullName,
    email,
    password,
    businessId: business.id,
  });

  // Give the Master Tester a normal BUSINESS_ADMIN role only for sensible
  // frontend navigation/default landing. Its actual unrestricted tester
  // authority remains separate in tester_accounts and auth middleware.
  const businessAdminRole =
    (await db.Role.findOne({
      where: { businessId: business.id, key: "BUSINESS_ADMIN" },
    })) ||
    (await db.Role.findOne({
      where: { businessId: null, key: "BUSINESS_ADMIN" },
    }));

  if (businessAdminRole && tester?.userId) {
    await db.UserRole.findOrCreate({
      where: {
        userId: tester.userId,
        roleId: businessAdminRole.id,
      },
      defaults: {
        userId: tester.userId,
        roleId: businessAdminRole.id,
      },
    });
  }

  console.log("\n✅ Master Tester is ready");
  console.log(`Name:     ${fullName}`);
  console.log(`Email:    ${email}`);
  console.log(`Business: ${business.name} (${business.id})`);
  console.log(`Level:    ${tester?.testerLevel || "MASTER"}`);
  console.log(`UI role:  ${businessAdminRole ? "BUSINESS_ADMIN" : "No BUSINESS_ADMIN role found"}`);

  if (!suppliedPassword) {
    console.log("\nTemporary password (shown because no MASTER_TESTER_PASSWORD was supplied):");
    console.log(password);
    console.log("\nStore it securely. Re-running this script without MASTER_TESTER_PASSWORD generates a new password.");
  } else {
    console.log("Password: supplied by MASTER_TESTER_PASSWORD");
  }
}

main()
  .then(async () => {
    await db.sequelize.close();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("❌ Failed to seed Master Tester:", error?.message || error);
    try {
      await db.sequelize.close();
    } catch {
      // ignore shutdown errors
    }
    process.exit(1);
  });

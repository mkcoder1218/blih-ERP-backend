import bcrypt from "bcrypt";
import crypto from "crypto";
import { env } from "../config/env";
import { db } from "../models";
import { TesterAccount } from "../modules/tester/tester.models";
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

  const existingMaster = await TesterAccount.findOne({
    where: { testerLevel: "MASTER" },
  });

  let tester: any;
  let printedPassword: string | null = null;

  if (existingMaster) {
    tester = existingMaster;
    const existingUser = await db.User.findByPk(existingMaster.userId);
    if (!existingUser) {
      throw new Error("The Master Tester metadata exists but its user account is missing.");
    }

    // Re-running the seed is safe: without an explicit password we do NOT
    // rotate the Master password or print a credential that was never applied.
    if (suppliedPassword) {
      existingUser.password = await bcrypt.hash(suppliedPassword, env.bcryptSaltRounds);
      printedPassword = suppliedPassword;
    }

    existingUser.fullName = fullName || existingUser.fullName;
    existingUser.email = email || existingUser.email;
    existingUser.status = "active";
    existingUser.isTestAccount = true;
    await existingUser.save();
  } else {
    const password = suppliedPassword || generatedPassword();
    tester = await service.bootstrapMaster({
      fullName,
      email,
      password,
      businessId: business.id,
    });
    printedPassword = password;
  }

  const testerUserId = tester?.userId;
  if (!testerUserId) {
    throw new Error("Master Tester user id could not be resolved.");
  }

  // Give the Master Tester a normal BUSINESS_ADMIN role only for sensible
  // frontend navigation/default landing. Its actual unrestricted tester
  // authority remains separate in tester_accounts and auth middleware.
  const currentUser = await db.User.findByPk(testerUserId);
  const effectiveBusinessId = currentUser?.businessId || business.id;
  const businessAdminRole =
    (await db.Role.findOne({
      where: { businessId: effectiveBusinessId, key: "BUSINESS_ADMIN" },
    })) ||
    (await db.Role.findOne({
      where: { businessId: null, key: "BUSINESS_ADMIN" },
    }));

  if (businessAdminRole) {
    await db.UserRole.findOrCreate({
      where: {
        userId: testerUserId,
        roleId: businessAdminRole.id,
      },
      defaults: {
        userId: testerUserId,
        roleId: businessAdminRole.id,
      },
    });
  }

  console.log("\n✅ Master Tester is ready");
  console.log(`Name:     ${currentUser?.fullName || fullName}`);
  console.log(`Email:    ${currentUser?.email || email}`);
  console.log(`Business: ${currentUser?.businessId || business.id}`);
  console.log("Level:    MASTER");
  console.log(`UI role:  ${businessAdminRole ? "BUSINESS_ADMIN" : "No BUSINESS_ADMIN role found"}`);

  if (printedPassword) {
    console.log(
      existingMaster
        ? "\nMASTER_TESTER_PASSWORD was applied. Current password:"
        : "\nMaster Tester password:",
    );
    console.log(printedPassword);
    if (!suppliedPassword) {
      console.log("\nStore it securely. This generated password is shown only on the first bootstrap run.");
    }
  } else {
    console.log("\nExisting Master Tester detected. Password was left unchanged.");
    console.log("Set MASTER_TESTER_PASSWORD and run the command again if you intentionally want to rotate it.");
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

import bcrypt from "bcrypt";
import { env } from "../config/env";
import { db } from "../models";

async function ensurePlatformBusiness() {
  const [plan] = await db.Plan.findOrCreate({
    where: { key: "free" },
    defaults: { key: "free", name: "Free", priceMonthly: 0, userLimit: 5, status: "active" }
  });

  const [business] = await db.Business.findOrCreate({
    where: { slug: "platform" },
    defaults: {
      name: "Platform",
      slug: "platform",
      email: env.platformAdmin?.email || "platform@example.com",
      phone: "+0000000000",
      status: "active",
      planId: plan.id
    }
  });

  return business;
}

export async function seedPlatformSuperAdminFromEnv() {
  const name = env.platformAdmin?.name;
  const email = env.platformAdmin?.email;
  const password = env.platformAdmin?.password;

  // If any are missing, do nothing (non-fatal).
  if (!name || !email || !password) return;

  const platformBusiness = await ensurePlatformBusiness();

  const existing = await db.User.findOne({ where: { businessId: platformBusiness.id, email } });
  if (existing) return;

  const hashed = await bcrypt.hash(password, env.bcryptSaltRounds);
  const user = await db.User.create({
    businessId: platformBusiness.id,
    fullName: name,
    email,
    password: hashed,
    phone: null,
    status: "active",
    isPlatformSuperAdmin: true
  });

  const platformRole = await db.Role.findOne({ where: { businessId: null, key: "PLATFORM_SUPER_ADMIN" } });
  if (platformRole) await user.setRoles([platformRole]);
}


import { db } from "../models";
import { sanitizeArticleContent } from "../modules/brain/brain.sanitizer";
import { computePolicyContentHash } from "../modules/policy/policy.sanitizer";
import { Op } from "sequelize";

async function run() {
  if (process.env.NODE_ENV === "production") {
    console.error("Safety check failed: Refusing to run dev/test seed in production environment!");
    process.exit(1);
  }

  await db.sequelize.authenticate();
  console.log("Connected to the database. Starting Brain & E-Policy seed...");

  // 1. Get business — use SEED_BUSINESS_ID env var or default to Blih-test
  const targetBusinessId = process.env.SEED_BUSINESS_ID || "99fc7d4b-b085-4229-a563-8086fdfee17d";
  const business = await db.Business.findByPk(targetBusinessId);
  if (!business) {
    throw new Error(`Business not found for ID: ${targetBusinessId}`);
  }
  const businessId = business.id;
  console.log(`Seeding for Business: ${business.name} (${businessId})`);

  // 2. Fetch dependencies
  const employees = await db.EmployeeRecord.findAll({
    where: { businessId, employmentStatus: "active" },
    order: [["createdAt", "ASC"]],
    limit: 6
  });

  if (employees.length < 2) {
    throw new Error("At least 2 active employees are required to seed acceptances.");
  }

  const departments = await db.Department.findAll({ where: { businessId } });
  const positions = await db.Position.findAll({ where: { businessId } });

  const adminRole = await db.Role.findOne({ where: { key: "BUSINESS_ADMIN" } });
  const hrRole = await db.Role.findOne({ where: { key: "HR_MANAGER" } });
  const empRole = await db.Role.findOne({ where: { key: "EMPLOYEE" } });

  // Use employees for roles
  const emp1 = employees[0];
  const emp2 = employees[1];
  const emp3 = employees[2] || emp1;
  const emp4 = employees[3] || emp2;
  const emp5 = employees[4] || emp1;

  await db.sequelize.transaction(async (transaction: any) => {
    // ──────── BRAIN SEEDING ────────
    console.log("Seeding Brain categories...");
    const [brainParent] = await db.KnowledgeCategory.findOrCreate({
      where: { businessId, name: "Company Policies & Procedures" },
      defaults: {
        key: "company-policies",
        description: "General guidelines and official policies.",
        visibility: "company",
        status: "active"
      },
      transaction
    });

    const [brainChild] = await db.KnowledgeCategory.findOrCreate({
      where: { businessId, name: "Security & IT Guidelines" },
      defaults: {
        key: "security-it-guidelines",
        description: "IT standards and information security rules.",
        parentCategoryId: brainParent.id,
        visibility: "company",
        status: "active"
      },
      transaction
    });

    console.log("Seeding Knowledge Articles...");
    const articlesData = [
      {
        title: "Draft - General IT Guide",
        slug: "draft-general-it-guide",
        status: "draft",
        visibility: "company",
        content: "<h1>Draft</h1><p>Under construction.</p>",
        categoryId: brainChild.id
      },
      {
        title: "In Review - Secure Remote Work Guidelines",
        slug: "in-review-secure-remote-work",
        status: "in_review",
        visibility: "company",
        content: "<h1>Remote Work Guidelines</h1><p>Always use a VPN connection.</p>",
        categoryId: brainChild.id
      },
      {
        title: "Changes Requested - Office Safety Protocol",
        slug: "changes-requested-office-safety",
        status: "changes_requested",
        visibility: "company",
        content: "<h1>Office Safety</h1><p>Needs safety inspector signatures.</p>",
        categoryId: brainParent.id
      },
      {
        title: "Approved - Code of Ethics",
        slug: "approved-code-of-ethics",
        status: "approved",
        visibility: "company",
        content: "<h1>Ethics</h1><p>Maintain complete transparency.</p>",
        categoryId: brainParent.id
      },
      {
        title: "Published - Employee Handbook",
        slug: "published-employee-handbook",
        status: "published",
        visibility: "company",
        content: "<h1>Employee Handbook</h1><p>Welcome to Blih ERP!</p>",
        categoryId: brainParent.id
      },
      {
        title: "Archived - Old Travel Expenses Policy",
        slug: "archived-old-travel-expenses",
        status: "archived",
        visibility: "company",
        content: "<h1>Old Travel Policy</h1><p>Replaced by new expense process.</p>",
        categoryId: brainParent.id
      }
    ];

    for (const art of articlesData) {
      const { content: sanitizedHtml, contentText } = sanitizeArticleContent(art.content);
      const [article, created] = await db.KnowledgeArticle.findOrCreate({
        where: { businessId, slug: art.slug },
        defaults: {
          businessId,
          categoryId: art.categoryId,
          title: art.title,
          slug: art.slug,
          summary: "Official system seeded article.",
          content: sanitizedHtml,
          contentText,
          status: art.status,
          visibility: art.visibility,
          authorUserId: emp1.userId,
          version: 1
        },
        transaction
      });

      // If created, seed version 1 revision
      if (created) {
        await db.KnowledgeRevision.create({
          businessId,
          articleId: article.id,
          version: 1,
          changeSummary: "Initial seeding",
          revisedByUserId: emp1.userId,
          contentSnapshot: {
            title: article.title,
            content: article.content,
            summary: article.summary
          }
        }, { transaction });
      }
    }

    // ──────── POLICY SEEDING ────────
    console.log("Seeding Policy categories...");
    const [policyParent] = await db.PolicyCategory.findOrCreate({
      where: { businessId, name: "Governance & Compliance" },
      defaults: {
        key: "governance-compliance",
        description: "Official regulatory compliance documents.",
        status: "active"
      },
      transaction
    });

    const [policyChild] = await db.PolicyCategory.findOrCreate({
      where: { businessId, name: "Human Resources Policies" },
      defaults: {
        key: "hr-policies",
        description: "Staff hiring, conduct, and leave policies.",
        parentCategoryId: policyParent.id,
        status: "active"
      },
      transaction
    });

    console.log("Seeding Policies...");
    const policiesData = [
      {
        title: "Draft - Remote Work Policy",
        slug: "draft-remote-work",
        status: "draft",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: false,
        requiresReacceptanceOnUpdate: true
      },
      {
        title: "In Review - Anti-Harassment Policy",
        slug: "in-review-anti-harassment",
        status: "in_review",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: true,
        requiresReacceptanceOnUpdate: true
      },
      {
        title: "Changes Requested - Data Protection Policy",
        slug: "changes-requested-data-protection",
        status: "changes_requested",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: true,
        requiresReacceptanceOnUpdate: true
      },
      {
        title: "Approved - Social Media Policy",
        slug: "approved-social-media",
        status: "approved",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: false,
        requiresReacceptanceOnUpdate: false
      },
      {
        title: "Scheduled - Travel and Expense Policy",
        slug: "scheduled-travel-expense",
        status: "scheduled",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: false,
        requiresReacceptanceOnUpdate: true,
        effectiveFrom: new Date(Date.now() + 86400000) // Tomorrow
      },
      {
        title: "Published - Equal Opportunity Employment Policy",
        slug: "published-equal-opportunity",
        status: "published",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: false,
        requiresReacceptanceOnUpdate: true,
        effectiveFrom: new Date(Date.now() - 86400000) // Yesterday
      },
      {
        title: "Superseded - Health and Safety Policy",
        slug: "superseded-health-safety",
        status: "superseded",
        visibility: "company",
        requiresAcceptance: true,
        requiresSignature: true,
        requiresReacceptanceOnUpdate: true
      },
      {
        title: "Archived - IT Security Policy",
        slug: "archived-it-security",
        status: "archived",
        visibility: "private",
        requiresAcceptance: false,
        requiresSignature: false,
        requiresReacceptanceOnUpdate: false
      }
    ];

    for (const pol of policiesData) {
      const { content: sanitizedHtml, contentText } = sanitizeArticleContent("<h1>" + pol.title + "</h1><p>This is official seeded policy text.</p>");
      const [policy, created] = await db.Policy.findOrCreate({
        where: { businessId, slug: pol.slug },
        defaults: {
          businessId,
          categoryId: policyChild.id,
          title: pol.title,
          slug: pol.slug,
          summary: "Seeded compliance standard.",
          contentHtml: sanitizedHtml,
          contentText,
          version: 1,
          versionLabel: "v1.0",
          status: pol.status,
          visibility: pol.visibility,
          confidentialityLevel: "normal",
          requiresAcceptance: pol.requiresAcceptance,
          requiresSignature: pol.requiresSignature,
          requiresReacceptanceOnUpdate: pol.requiresReacceptanceOnUpdate,
          effectiveFrom: pol.effectiveFrom || new Date(),
          ownerUserId: emp1.userId,
          createdById: emp1.userId,
          updatedById: emp1.userId,
          appliesToAllEmployees: false
        },
        transaction
      });

      const hash = computePolicyContentHash({
        policyId: policy.id,
        version: 1,
        title: policy.title,
        contentHtml: policy.contentHtml,
        effectiveFrom: policy.effectiveFrom,
        effectiveUntil: policy.effectiveUntil,
        requiresAcceptance: policy.requiresAcceptance,
        requiresSignature: policy.requiresSignature
      });

      // Seeding version 1 snapshot
      const [version] = await db.PolicyVersion.findOrCreate({
        where: { policyId: policy.id, version: 1 },
        defaults: {
          businessId,
          policyId: policy.id,
          version: 1,
          versionLabel: policy.versionLabel,
          title: policy.title,
          slug: policy.slug,
          policyType: "GENERAL",
          summary: "Seeded compliance standard.",
          contentHtml: policy.contentHtml,
          contentText: policy.contentText,
          contentHash: hash,
          visibility: policy.visibility,
          confidentialityLevel: policy.confidentialityLevel,
          effectiveFrom: policy.effectiveFrom,
          requiresAcceptance: policy.requiresAcceptance,
          requiresSignature: policy.requiresSignature,
          assignmentSnapshot: [],
          statusAtCreation: policy.status,
          action: "CREATE_POLICY",
          createdByUserId: emp1.userId
        },
        transaction
      });

      // ──────── ASSIGNMENTS & OBLIGATIONS ────────
      if (pol.status === "published" || pol.status === "scheduled") {
        console.log(`Seeding assignments for: ${pol.title}...`);

        const assignmentsToCreate = [
          { subjectType: "COMPANY", subjectId: "ALL", assignmentType: "INCLUDE" },
          { subjectType: "DEPARTMENT", subjectId: departments[0]?.id || "ALL", assignmentType: "INCLUDE" },
          { subjectType: "POSITION", subjectId: positions[0]?.id || "ALL", assignmentType: "INCLUDE" },
          { subjectType: "ROLE", subjectId: empRole?.id || "ALL", assignmentType: "INCLUDE" },
          { subjectType: "EMPLOYEE", subjectId: emp2.id, assignmentType: "EXCLUDE" } // Exclude Employee 2
        ];

        for (const ass of assignmentsToCreate) {
          if (ass.subjectId === "ALL") continue;
          await db.PolicyAssignment.findOrCreate({
            where: {
              policyId: policy.id,
              policyVersionId: version.id,
              subjectType: ass.subjectType,
              subjectId: ass.subjectId
            },
            defaults: {
              businessId,
              policyId: policy.id,
              policyVersionId: version.id,
              subjectType: ass.subjectType,
              subjectId: ass.subjectId,
              assignmentType: ass.assignmentType,
              isRequired: true,
              assignedByUserId: emp1.userId
            },
            transaction
          });
        }

        // ──────── POLICY ACCEPTANCES (OBLIGATIONS) ────────
        if (pol.status === "published") {
          console.log(`Seeding acceptances for: ${pol.title}...`);

          const acceptancesToCreate = [
            { employee: emp1, status: "accepted", acceptedAt: new Date() },
            { employee: emp2, status: "pending", dueAt: new Date(Date.now() + 86400000 * 7) },
            { employee: emp3, status: "viewed", viewedAt: new Date() },
            { employee: emp4, status: "signed", signedAt: new Date(), signatureType: "typed_name", typedSignatureName: "Seeded User" },
            { employee: emp5, status: "overdue", dueAt: new Date(Date.now() - 86400000) } // Past due
          ];

          for (const acc of acceptancesToCreate) {
            await db.PolicyAcceptance.findOrCreate({
              where: {
                policyVersionId: version.id,
                employeeId: acc.employee.id
              },
              defaults: {
                businessId,
                policyId: policy.id,
                policyVersionId: version.id,
                userId: acc.employee.userId,
                employeeId: acc.employee.id,
                policyVersion: 1,
                status: acc.status,
                assignedAt: new Date(),
                dueAt: acc.dueAt || new Date(Date.now() + 86400000 * 14),
                viewedAt: acc.viewedAt || null,
                acceptedAt: acc.acceptedAt || acc.signedAt || null,
                signedAt: acc.signedAt || null,
                signatureType: acc.signatureType || null,
                typedSignatureName: acc.typedSignatureName || null,
                acceptedContentHash: hash
              },
              transaction
            });
          }
        }
      }
    }
  });

  console.log("Seeding complete! Brain & E-Policy demo records created successfully.");
}

run()
  .catch((error) => {
    console.error("Seed execution failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.sequelize.close();
  });

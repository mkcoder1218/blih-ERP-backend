/**
 * Seed: Ready-to-Post Jobs
 * Creates several JobOpening rows with status='approved' so the
 * RecruitmentReadyToPost table has visible data for testing.
 *
 * Usage:
 *   npx ts-node -e "require('./src/scripts/seedReadyToPostJobs').run()"
 *   — or —
 *   npx ts-node src/scripts/seedReadyToPostJobs.ts
 */

import dotenv from 'dotenv';
dotenv.config();

async function run() {
  // Lazy-load models after env is ready
  const { db } = await import('../models/index.js' as any).catch(() => require('../models'));

  await db.sequelize.authenticate();
  console.log('✔  DB connected');

  // Grab the first available business and user to satisfy FK constraints
  const business = await db.Business.findOne({ order: [['createdAt', 'ASC']] });
  if (!business) { console.error('✖  No business found — run the main seed first'); process.exit(1); }

  const user = await db.User.findOne({
    where: { businessId: business.id },
    order: [['createdAt', 'ASC']],
  });
  if (!user) { console.error('✖  No user found for business', business.id); process.exit(1); }

  console.log(`→  businessId: ${business.id}  |  userId: ${user.id}`);

  const approvedMeta = {
    approvalStatus: 'approved',
    approvalStage: 'approved',
    currentReviewer: 'CEO / Business Admin',
    approvalHistory: [
      { stage: 'hr_review', action: 'approved', role: 'HR_MANAGER', userName: 'HR Manager', at: new Date().toISOString() },
      { stage: 'final_approval', action: 'approved', role: 'CEO', userName: 'Chief Executive', at: new Date().toISOString() },
    ],
  };

  const jobs = [
    {
      title: 'Senior Frontend Engineer',
      employmentType: 'Full-time',
      headcount: 2,
      priority: 'High',
      description: 'Build and maintain our web platform using React and TypeScript.',
      metadata: {
        ...approvedMeta,
        department: 'ENGINEERING',
        requirements: ['5+ years React experience', 'TypeScript proficiency', 'UI/UX sensibility'],
        qualifications: ['Experience with design systems', 'Open-source contributions a plus'],
        importance: 'Critical for launching v2 of the product on schedule.',
        requestedBy: { name: user.fullName || 'Requester', dept: 'ENGINEERING', avatar: (user.fullName || 'R').charAt(0) },
        dueDate: '2025-09-01',
        expectedDate: '2025-08-15',
        requestedDate: new Date().toISOString().slice(0, 10),
        overview: 'We need a talented frontend engineer to drive our redesign initiative and mentor junior developers.',
      },
    },
    {
      title: 'Product Manager',
      employmentType: 'Full-time',
      headcount: 1,
      priority: 'High',
      description: 'Lead product strategy and roadmap for our ERP platform.',
      metadata: {
        ...approvedMeta,
        department: 'PRODUCT',
        requirements: ['3+ years PM experience', 'B2B SaaS background', 'Strong analytical skills'],
        qualifications: ['MBA preferred', 'Experience with OKR frameworks'],
        importance: 'No dedicated PM currently — this hire unblocks 3 feature squads.',
        requestedBy: { name: user.fullName || 'Requester', dept: 'PRODUCT', avatar: (user.fullName || 'R').charAt(0) },
        dueDate: '2025-08-20',
        expectedDate: '2025-08-01',
        requestedDate: new Date().toISOString().slice(0, 10),
        overview: 'Own the product vision, prioritize the backlog, and coordinate cross-functional delivery.',
      },
    },
    {
      title: 'HR Business Partner',
      employmentType: 'Full-time',
      headcount: 1,
      priority: 'Medium',
      description: 'Partner with department heads to drive people strategy.',
      metadata: {
        ...approvedMeta,
        department: 'HUMAN RESOURCES',
        requirements: ['4+ years HRBP experience', 'Knowledge of Ethiopian labour law', 'Strong communication'],
        qualifications: ['SHRM certification a plus', 'Experience in fast-growing companies'],
        importance: 'Growing headcount requires dedicated HR support per department.',
        requestedBy: { name: user.fullName || 'Requester', dept: 'HR', avatar: (user.fullName || 'R').charAt(0) },
        dueDate: '2025-09-15',
        expectedDate: '2025-09-01',
        requestedDate: new Date().toISOString().slice(0, 10),
        overview: 'Work alongside managers to handle talent processes, performance cycles, and employee relations.',
      },
    },
    {
      title: 'Data Analyst',
      employmentType: 'Full-time',
      headcount: 1,
      priority: 'Medium',
      description: 'Turn raw business data into actionable insights for leadership.',
      metadata: {
        ...approvedMeta,
        department: 'DIGITAL MARKETING',
        requirements: ['SQL proficiency', 'Experience with BI tools (Metabase / Tableau)', 'Python or R basics'],
        qualifications: ['Background in marketing analytics', 'Dashboard design experience'],
        importance: 'Marketing decisions are currently made without data — this role fixes that.',
        requestedBy: { name: user.fullName || 'Requester', dept: 'MARKETING', avatar: (user.fullName || 'R').charAt(0) },
        dueDate: '2025-08-30',
        expectedDate: '2025-08-15',
        requestedDate: new Date().toISOString().slice(0, 10),
        overview: 'Build and maintain dashboards, run ad-hoc analyses, and present findings to the executive team.',
      },
    },
    {
      title: 'DevOps Engineer',
      employmentType: 'Full-time',
      headcount: 1,
      priority: 'Low',
      description: 'Improve our deployment pipeline and infrastructure reliability.',
      metadata: {
        ...approvedMeta,
        department: 'ENGINEERING',
        requirements: ['Docker & Kubernetes experience', 'CI/CD pipeline ownership', 'Linux administration'],
        qualifications: ['AWS / GCP certifications', 'Security-first mindset'],
        importance: 'Current deployment process is manual and error-prone — blocking release velocity.',
        requestedBy: { name: user.fullName || 'Requester', dept: 'ENGINEERING', avatar: (user.fullName || 'R').charAt(0) },
        dueDate: '2025-10-01',
        expectedDate: '2025-09-15',
        requestedDate: new Date().toISOString().slice(0, 10),
        overview: 'Automate, monitor, and scale our cloud infrastructure while maintaining 99.9% uptime.',
      },
    },
  ];

  let created = 0;
  for (const job of jobs) {
    const [, wasCreated] = await db.JobOpening.findOrCreate({
      where: { businessId: business.id, title: job.title, status: 'approved' },
      defaults: {
        businessId: business.id,
        requestedByUserId: user.id,
        status: 'approved',
        ...job,
      },
    });
    if (wasCreated) { created++; console.log(`  ✔  Created: ${job.title}`); }
    else console.log(`  –  Already exists: ${job.title}`);
  }

  console.log(`\n✅  Done — ${created} new job(s) seeded, ${jobs.length - created} already existed.`);
  await db.sequelize.close();
}

run().catch((err) => { console.error('Seed failed:', err); process.exit(1); });

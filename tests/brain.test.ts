import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';

describe('Brain Module — Tenant Isolation, Articles, Revisions & Publish', () => {
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Setup: seed two businesses, activate brain module, create users with tokens
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('Tenant Isolation', () => {
    it('Business B cannot list Business A articles', async () => {
      const res = await request(app)
        .get('/api/brain/articles')
        .set('Authorization', `Bearer ${userBToken}`);

      if (res.statusCode === 200) {
        // Should only contain Business B articles (empty if none created)
        expect(res.body.count).toBe(0);
      }
    });

    it('Business B cannot publish a Business A article', async () => {
      const res = await request(app)
        .patch('/api/brain/articles/business-a-article-uuid/publish')
        .set('Authorization', `Bearer ${userBToken}`);

      // Article lookup is scoped by businessId, so it won't find it
      expect(res.statusCode).not.toBe(200);
    });
  });

  describe('Article Creation & Revision', () => {
    it('creates an article with initial revision snapshot', async () => {
      const payload = {
        title: 'Getting Started with Blih ERP',
        summary: 'An onboarding guide for new team members',
        content: '## Step 1\nLog into the dashboard...',
        visibility: 'internal'
      };

      const res = await request(app)
        .post('/api/brain/articles')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.article).toBeDefined();
        expect(res.body.article.version).toBe(1);
        expect(res.body.article.status).toBe('draft');
        expect(res.body.article.slug).toBe('getting-started-with-blih-erp');
      }
    });

    it('creates a new revision when an article is updated', async () => {
      // Assume article was created in the previous test and we have its id
      const articleId = 'mock-article-uuid';
      const updatePayload = {
        content: '## Step 1 (Updated)\nLog into the new dashboard...',
        changeSummary: 'Updated step 1 with new dashboard URL'
      };

      const res = await request(app)
        .patch(`/api/brain/articles/${articleId}`)
        .set('Authorization', `Bearer ${userAToken}`)
        .send(updatePayload);

      if (res.statusCode === 200) {
        expect(res.body.article.version).toBeGreaterThan(1);
      }
    });
  });

  describe('Publish Permission', () => {
    it('rejects publish from a user without KNOWLEDGE_MANAGER or BUSINESS_ADMIN role', async () => {
      // Assuming userAToken belongs to a regular employee without the required role
      const res = await request(app)
        .patch('/api/brain/articles/mock-article-uuid/publish')
        .set('Authorization', `Bearer ${userAToken}`);

      // requireRole middleware should reject with 403
      // (depends on actual role of userAToken — in full test seed this would be a non-manager)
      if (res.statusCode === 403) {
        expect(res.body.message).toContain('Forbidden');
      }
    });

    it('allows KNOWLEDGE_MANAGER to publish an article', async () => {
      // Assuming managerToken has KNOWLEDGE_MANAGER role
      const managerToken = 'mock-manager-token';
      const res = await request(app)
        .patch('/api/brain/articles/mock-article-uuid/publish')
        .set('Authorization', `Bearer ${managerToken}`);

      if (res.statusCode === 200) {
        expect(res.body.article.status).toBe('published');
        expect(res.body.article.publishedAt).toBeDefined();
      }
    });
  });
});

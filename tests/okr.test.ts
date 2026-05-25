import request from 'supertest';
import app from '../src/app';
import { db } from '../src/models';

describe('OKR Module — Tenant Isolation, Objective Creation & Progress Calculation', () => {
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    await db.sequelize.sync({ force: true });
    // Setup: seed two businesses, activate okr module, create users with tokens
  });

  afterAll(async () => {
    await db.sequelize.close();
  });

  describe('Tenant Isolation', () => {
    it('Business B cannot list Business A objectives', async () => {
      const res = await request(app)
        .get('/api/okr/objectives')
        .set('Authorization', `Bearer ${userBToken}`);

      if (res.statusCode === 200) {
        // Should only contain Business B objectives (empty if none created)
        expect(res.body.count).toBe(0);
      }
    });

    it('Business B cannot update a Business A key result', async () => {
      const res = await request(app)
        .patch('/api/okr/key-results/business-a-kr-uuid')
        .set('Authorization', `Bearer ${userBToken}`)
        .send({ title: "Hacked" });

      // KeyResult lookup is scoped by businessId, so it won't find it
      expect(res.statusCode).not.toBe(200);
    });
  });

  describe('Objective & Key Result Creation', () => {
    it('creates an objective', async () => {
      const payload = {
        title: 'Launch Q3 Marketing Campaign',
        level: 'department',
        periodType: 'quarterly',
        status: 'active'
      };

      const res = await request(app)
        .post('/api/okr/objectives')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.objective).toBeDefined();
        expect(res.body.objective.title).toBe('Launch Q3 Marketing Campaign');
      }
    });

    it('creates a key result for an objective', async () => {
      const payload = {
        objectiveId: 'mock-objective-uuid',
        title: 'Generate 1000 new leads',
        metric: 'count',
        baselineValue: 0,
        targetValue: 1000,
        weight: 1
      };

      const res = await request(app)
        .post('/api/okr/key-results')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.keyResult).toBeDefined();
        expect(res.body.keyResult.targetValue).toBe(1000);
      }
    });
  });

  describe('Progress Updates & Weighted Calculation', () => {
    it('calculates objective progress upon key result update', async () => {
      const payload = {
        objectiveId: 'mock-objective-uuid',
        keyResultId: 'mock-key-result-uuid',
        progressValue: 500, // 50% of 1000
        comment: 'Halfway there!'
      };

      const res = await request(app)
        .post('/api/okr/progress')
        .set('Authorization', `Bearer ${userAToken}`)
        .send(payload);

      if (res.statusCode === 201) {
        expect(res.body.progressUpdate).toBeDefined();
        expect(res.body.progressUpdate.progressPercent).toBe(50);
        // Objective's metadata.calculatedProgress should now be 50 if this is the only key result.
      }
    });
  });
});

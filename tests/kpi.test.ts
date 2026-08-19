import { db } from '../src/models';
import { kpiService } from '../src/modules/okr/kpi.service';

describe('KPI Feature Integration & Mathematical Formulas Suite', () => {
  let business: any;
  let user: any;

  beforeAll(async () => {
    business = await db.Business.findOne();
    if (!business) {
      business = await db.Business.create({
        name: 'App Corp',
        slug: 'app-corp',
        currency: 'USD',
        status: 'active',
        settings: {}
      });
    }

    user = await db.User.findOne({ where: { businessId: business.id } });
    if (!user) {
      user = await db.User.create({
        businessId: business.id,
        fullName: 'KPI Auditor',
        email: 'auditor@app.local',
        password: 'securePassword123'
      });
    }
  });

  it('evaluates separate progress formulas for INCREASE and DECREASE direction', () => {
    // INCREASE
    const kpiIncrease = {
      baselineValue: 10,
      targetValue: 50,
      currentValue: 45,
      direction: 'INCREASE'
    };
    // ((45 - 10) / (50 - 10)) * 100 = 87.5%
    let progress = kpiService.deriveKpiStatus(kpiIncrease.currentValue, kpiIncrease.baselineValue, kpiIncrease.targetValue, kpiIncrease.direction);
    expect(progress).toBe('ON_TARGET');

    // DECREASE
    const kpiDecrease = {
      baselineValue: 100,
      targetValue: 20,
      currentValue: 60,
      direction: 'DECREASE'
    };
    // ((100 - 60) / (100 - 20)) * 100 = 50%
    progress = kpiService.deriveKpiStatus(kpiDecrease.currentValue, kpiDecrease.baselineValue, kpiDecrease.targetValue, kpiDecrease.direction);
    expect(progress).toBe('BELOW_TARGET'); // 50% is less than 80% threshold

    // EXCEEDING_TARGET Check
    progress = kpiService.deriveKpiStatus(120, 10, 100, 'INCREASE');
    expect(progress).toBe('EXCEEDING_TARGET');
  });

  it('seeds predefined metric templates and lists KPIs', async () => {
    await kpiService.seedTemplatesIfEmpty();
    const listRes = await kpiService.listKpis(business.id, { limit: 10, offset: 0 });
    expect(listRes.metricTemplates.length).toBeGreaterThan(0);
  });

  it('performs CRUD operations on KPI', async () => {
    const kpi = await kpiService.createKpi(business.id, user.id, {
      title: 'Monthly Active Developers',
      category: 'Engineering',
      ownerType: 'COMPANY',
      ownerId: null,
      measurementType: 'NUMBER',
      unit: 'devs',
      direction: 'INCREASE',
      baselineValue: 50,
      currentValue: 60,
      targetValue: 100,
      updateFrequency: 'MONTHLY',
      trackingType: 'MANUAL'
    });

    expect(kpi.title).toBe('Monthly Active Developers');
    expect(kpi.status).toBe('BELOW_TARGET'); // (60-50)/(100-50) = 20% < 80%

    // Update
    const updated = await kpiService.updateKpi(business.id, kpi.id, {
      currentValue: 95
    });
    expect(updated.currentValue).toBe(95);
    expect(updated.status).toBe('ON_TARGET'); // 90% progress >= 80%

    // Manual Log value
    const logRes = await kpiService.logKpiManualValue(business.id, user.id, kpi.id, 110, 'Target exceeded!');
    expect(logRes.kpi.status).toBe('EXCEEDING_TARGET');

    // Clean up
    await kpiService.deleteKpi(business.id, kpi.id);
  });
});

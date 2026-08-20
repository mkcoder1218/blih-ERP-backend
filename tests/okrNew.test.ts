import { db } from '../src/models';
import { okrService } from '../src/modules/okr/okr.service';
import { metricCalculatorRegistry } from '../src/modules/okr/metricCalculatorRegistry';

describe('OKR Module (New System) — Service & Registry tests', () => {
  let business: any;
  let user: any;

  beforeAll(async () => {
    // Basic setup - we don't call force:true to avoid erasing main database state, 
    // instead we transact or clean up our specific rows.
    business = await db.Business.findOne();
    if (!business) {
      business = await db.Business.create({
        name: 'Test Corp',
        slug: 'test-corp',
        currency: 'USD',
        status: 'active',
        settings: {}
      });
    }

    user = await db.User.findOne({ where: { businessId: business.id } });
    if (!user) {
      user = await db.User.create({
        businessId: business.id,
        fullName: 'Test Employee',
        email: 'test@employee.local',
        password: 'securePassword123'
      });
    }
  });

  it('correctly calculates progress based on direction', () => {
    // HIGHER_IS_BETTER
    const krHigher = {
      baselineValue: 10,
      targetValue: 50,
      currentValue: 30,
      direction: 'HIGHER_IS_BETTER'
    };
    const progressHigher = okrService.calculateKrProgress(krHigher);
    expect(progressHigher).toBe(50); // (30 - 10)/(50 - 10) = 50%

    // LOWER_IS_BETTER
    const krLower = {
      baselineValue: 100,
      targetValue: 20,
      currentValue: 60,
      direction: 'LOWER_IS_BETTER'
    };
    const progressLower = okrService.calculateKrProgress(krLower);
    expect(progressLower).toBe(50); // (100 - 60)/(100 - 20) = 50%
  });

  it('correctly calculates health status from score', () => {
    expect(okrService.calculateKrHealth(80)).toBe('ON_TRACK');
    expect(okrService.calculateKrHealth(55)).toBe('AT_RISK');
    expect(okrService.calculateKrHealth(10)).toBe('OFF_TRACK');
  });

  it('seeds metric templates when requested', async () => {
    await okrService.seedMetricTemplatesIfEmpty();
    const count = await db.OkrMetricTemplate.count();
    expect(count).toBeGreaterThan(0);
  });

  it('saves manual check-ins and recalculates progress', async () => {
    const obj = await okrService.createObjective(business.id, user.id, {
      title: 'Double Inbound Traffic',
      ownerType: 'EMPLOYEE',
      ownerId: user.id,
      periodStart: '2026-01-01',
      periodEnd: '2026-03-31',
      keyResults: [
        {
          title: 'Unique monthly visitors',
          trackingType: 'MANUAL',
          baselineValue: 1000,
          targetValue: 2000,
          currentValue: 1000,
          weight: 1.0
        }
      ]
    });

    expect(obj.overallScore).toBe(0);

    const kr = obj.keyResults[0];
    const checkIn = await okrService.logCheckIn(business.id, user.id, {
      keyResultId: kr.id,
      currentValue: 1500,
      note: 'Solid midpoint update!'
    });

    expect(checkIn.progressValue).toBe(1500);

    const refreshedObj = await okrService.getObjective(business.id, obj.id);
    expect(refreshedObj.overallScore).toBe(50);
    expect(refreshedObj.healthStatus).toBe('AT_RISK');

    // Clean up
    await refreshedObj.destroy();
  });
});

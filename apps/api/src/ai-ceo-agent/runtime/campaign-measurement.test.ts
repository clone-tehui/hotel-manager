import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { measureCampaignOutcome } from './campaign-measurement';

const baseline = { bookedNights: 1, bookedNightRevenue: 100, occupancy: 10, adr: 100, revPar: 10 };
const actual = { occupiedNights: 3, bookedNightRevenue: 360, occupancyRate: 30, totalNightsInPeriod: 10 };

test('measures completed campaign against stored baseline without causal attribution', () => {
  const result = measureCampaignOutcome({ baseline, actual, periodTo: new Date('2026-01-02T23:59:59Z'), measuredAt: new Date('2026-01-03T00:00:00Z'), sourceGeneratedAt: '2026-01-03T00:00:00.000Z' });
  assert.equal(result.status, 'MEASURED');
  if (result.status !== 'MEASURED') throw new Error('expected measurement');
  const measured: any = result;
  assert.equal(measured.outcome, 'IMPROVED');
  assert.equal(measured.deltas.bookedNights, 2);
  assert.equal(measured.deltas.revenue, 260);
  assert.equal(measured.deltas.occupancy, 20);
  assert.equal(measured.actual.adr, 120);
  assert.match(result.confounders[0], /No causal attribution/);
});

test('fails closed when period is not complete or metrics are unavailable', () => {
  const notDue = measureCampaignOutcome({ baseline, actual, periodTo: new Date('2026-01-03T00:00:00Z'), measuredAt: new Date('2026-01-03T00:00:00Z'), sourceGeneratedAt: '2026-01-03T00:00:00.000Z' });
  assert.equal(notDue.status, 'INSUFFICIENT_DATA');
  const missing = measureCampaignOutcome({ baseline: {}, actual, periodTo: new Date('2026-01-02T00:00:00Z'), measuredAt: new Date('2026-01-03T00:00:00Z'), sourceGeneratedAt: '2026-01-03T00:00:00.000Z' });
  assert.equal(missing.status, 'INSUFFICIENT_DATA');
});

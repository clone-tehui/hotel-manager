import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { breakEvenMetrics, bookedNightRevenue, businessPeriods, occupancyRate, overlapNights, vnDate } from './business-truth';

test('four horizons use Vietnam business date and Monday-Sunday', () => {
  const periods = businessPeriods(new Date('2026-08-31T00:30:00+07:00'));
  assert.deepEqual(periods, [
    { key: 'thisWeek', title: 'Tuần này', from: '2026-08-31', to: '2026-09-06', kind: 'week' },
    { key: 'nextWeek', title: 'Tuần sau', from: '2026-09-07', to: '2026-09-13', kind: 'week' },
    { key: 'thisMonth', title: 'Tháng này', from: '2026-08-01', to: '2026-08-31', kind: 'month' },
    { key: 'nextMonth', title: 'Tháng sau', from: '2026-09-01', to: '2026-09-30', kind: 'month' },
  ]);
});

test('next month is unavailable before Vietnam day 15, including UTC boundary', () => {
  const periods = businessPeriods(new Date('2026-08-14T17:30:00Z'));
  assert.equal(periods.some((period) => period.key === 'nextMonth'), true);
  const before = businessPeriods(new Date('2026-08-14T16:59:59Z'));
  assert.equal(before.some((period) => period.key === 'nextMonth'), false);
});

test('cross-month booking revenue is allocated by overlapping nights', () => {
  const checkIn = new Date('2026-08-29T14:00:00+07:00');
  const checkOut = new Date('2026-09-04T12:00:00+07:00');
  const augustNights = overlapNights(vnDate(2026, 8, 1), vnDate(2026, 9, 1), checkIn, checkOut);
  const septemberNights = overlapNights(vnDate(2026, 9, 1), vnDate(2026, 10, 1), checkIn, checkOut);
  assert.equal(augustNights, 3);
  assert.equal(septemberNights, 3);
  assert.equal(bookedNightRevenue(1_000_000, augustNights), 3_000_000);
  assert.equal(bookedNightRevenue(1_000_000, septemberNights), 3_000_000);
});

test('occupancy uses booked sellable nights over available sellable nights', () => {
  assert.equal(occupancyRate(2, 7), 28.6);
  assert.equal(occupancyRate(4, 7), 57.1);
  assert.equal(occupancyRate(0, 0), null);
});

test('break-even exposes deterministic detail without pretending unknown cost is zero', () => {
  assert.deepEqual(breakEvenMetrics(null, 5_000_000, 5, 10), { monthlyCost: null, bookedRevenue: 5_000_000, profit: null, revenueGap: null, breakEvenRevenue: null, breakEvenNights: null, bookedNights: 5, remainingSellableNights: 10, requiredADRToBreakEven: null, breakEvenReached: null, margin: null });
  const metrics = breakEvenMetrics(10_000_000, 6_000_000, 6, 4);
  assert.equal(metrics.profit, -4_000_000);
  assert.equal(metrics.revenueGap, 4_000_000);
  assert.equal(metrics.requiredADRToBreakEven, 1_000_000);
  assert.equal(metrics.breakEvenReached, false);
  assert.equal(breakEvenMetrics(10_000_000, 12_000_000, 6, 0).breakEvenReached, true);
});

import { monthSegments } from '../ai-ceo-agent/room-intelligence.service';
import { RoomIntelligenceService } from '../ai-ceo-agent/room-intelligence.service';

test('room intelligence declares unknown report freshness and historical sellability as assumptions', async () => {
  const service = new RoomIntelligenceService({
    room: {
      findMany: async () => [{
        id: 'room-1', number: 'A01', status: 'VACANT', price: 500000, discountablePrice: null, monthlyCost: null,
        updatedAt: new Date('2026-09-01T00:00:00.000Z'), building: { id: 'b1', code: 'A', name: 'A' }, roomType: { id: 't1', name: 'Studio' },
      }],
    },
  } as any, {
    getReport: async () => ({ occupancy: { byRoom: [{ roomId: 'room-1', occupiedNights: 2, totalNightsInPeriod: 7, bookedNightRevenue: 1000000 }] } }),
  } as any);
  const result = await service.getRoomEconomics({ periodKeys: ['thisWeek'], now: new Date('2026-09-01T12:00:00+07:00') });
  const row = result.rows[0];
  assert.equal(row.availability.status, 'ASSUMPTION');
  assert.equal(row.metricProvenance.bookedNights.freshness, 'UNKNOWN');
  assert.equal(row.metricProvenance.occupancy.status, 'ASSUMPTION');
  assert.equal(row.metricProvenance.economics.status, 'UNAVAILABLE');
  assert.equal(row.metricProvenance.priceFloor.status, 'UNAVAILABLE');
  assert.equal(row.source.freshnessStatus, 'UNKNOWN');
});

test('cross-month period exposes separate calendar-month supporting segments', () => {
  assert.deepEqual(monthSegments({ key: 'nextWeek', title: 'Tuần sau', from: '2026-08-28', to: '2026-09-03', kind: 'week' }), [
    { monthKey: '2026-08', from: '2026-08-28', to: '2026-08-31' },
    { monthKey: '2026-09', from: '2026-09-01', to: '2026-09-03' },
  ]);
});

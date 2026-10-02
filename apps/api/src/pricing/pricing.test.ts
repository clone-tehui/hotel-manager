import 'reflect-metadata';
import * as assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calculatePrice, normalizeStay, PricingService } from './pricing.service';
import { normalizeRule } from './stay-discount-rules.service';

function expectCode(callback: () => unknown, code: string) {
  assert.throws(callback, (failure: any) => failure.getResponse?.().error?.code === code);
}

async function main() {
  const stay = { roomId: 'test', checkInDate: '2026-10-10', checkOutDate: '2026-10-15' };
  const normalized = normalizeStay(stay);
  assert.equal(normalized.nights, 5);
  assert.equal(normalized.checkInDate.toISOString(), '2026-10-10T07:00:00.000Z');
  assert.equal(normalized.checkOutDate.toISOString(), '2026-10-15T05:00:00.000Z');
  assert.equal(normalizeStay({ ...stay, checkInDate: '2026-10-10T14:00:00+07:00', checkOutDate: '2026-10-15T12:00:00+07:00' }).nights, 5);
  for (const date of ['2026-02-30', '2026-13-01', 'bad', '2026-10-10T99:00:00Z']) expectCode(() => normalizeStay({ ...stay, checkInDate: date }), 'INVALID_STAY_DATES');
  expectCode(() => normalizeStay({ ...stay, checkOutDate: stay.checkInDate }), 'INVALID_STAY_DATES');
  const base = new Prisma.Decimal(2000000);
  assert.equal(calculatePrice(base, new Prisma.Decimal(0), 5).total, 10000000);
  const reduced = calculatePrice(base, new Prisma.Decimal(200000), 5);
  assert.equal(reduced.total, 9000000);
  assert.equal(reduced.totalDiscount, 1000000);
  assert.equal(reduced.finalPricePerNight, 1800000);
  expectCode(() => calculatePrice(base, base, 5), 'INVALID_DISCOUNT_CONFIGURATION');
  expectCode(() => calculatePrice(base, new Prisma.Decimal(3000000), 5), 'INVALID_DISCOUNT_CONFIGURATION');
  assert.equal(calculatePrice(new Prisma.Decimal('10.10'), new Prisma.Decimal('0.20'), 3).total, 29.7);
  const rule = normalizeRule({ minValue: 6, minUnit: 'MONTH', maxValue: 1, maxUnit: 'YEAR', discountPerNight: 200000 });
  assert.equal(rule.minNights, 180); assert.equal(rule.maxNights, 365);
  assert.equal(normalizeRule({ minValue: 1, minUnit: 'DAY', discountPerNight: 0 }).maxNights, null);
  expectCode(() => normalizeRule({ minValue: 6, minUnit: 'MONTH', maxValue: 1, maxUnit: 'MONTH', discountPerNight: 0 }), 'INVALID_DISCOUNT_CONFIGURATION');
  expectCode(() => normalizeRule({ minValue: 1, minUnit: 'DAY', maxUnit: 'MONTH', discountPerNight: 0 }), 'INVALID_DISCOUNT_CONFIGURATION');
  const room: any = { id: 'test', number: 'A07.06', roomTypeId: '2pn', roomType: { name: '2PN', basePrice: base }, price: base, isActive: true, status: 'VACANT' };
  let conflict: any = null;
  let rules: any[] = [];
  const database: any = {
    room: { findUnique: async () => room }, reservation: { findFirst: async () => conflict },
    roomHold: { findFirst: async () => null },
    roomTypeStayDiscountRule: { findMany: async () => rules },
  };
  const service = new PricingService(database);
  assert.equal((await service.calculate(database, stay)).pricing.total, 10000000);
  rules = [{ id: 'rule', discountPerNight: new Prisma.Decimal(200000) }];
  assert.equal((await service.calculate(database, { ...stay, discount: 'yes' })).pricing.total, 9000000);
  room.price = null;
  assert.equal((await service.calculate(database, stay)).pricing.priceSource, 'ROOM_TYPE_BASE_PRICE');
  room.status = 'MAINTENANCE';
  await assert.rejects(() => service.calculate(database, stay), (failure: any) => failure.getResponse().error.code === 'ROOM_MAINTENANCE');
  room.status = 'VACANT'; conflict = { id: 'booked' };
  await assert.rejects(() => service.calculate(database, stay), (failure: any) => failure.getResponse().error.code === 'ROOM_NO_LONGER_AVAILABLE');
  console.log('Pricing unit tests PASS: stay normalization, invalid dates, exact Decimal pricing, fallback, discounts, availability.');
}

main().catch((failure) => { console.error(failure); process.exitCode = 1; });

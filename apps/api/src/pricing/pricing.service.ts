import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { normalizeHotelCheckIn, normalizeHotelCheckOut, calcNights } from '../reservations/reservations.service';
import { PriceCheckDto } from './price-check.dto';
import { pricingError } from './pricing-error';
import { activeHoldWhere } from './inventory-lock.service';

export function normalizeStay(input: PriceCheckDto) {
  for (const value of [input.checkInDate, input.checkOutDate]) {
    const match = /^(\d{4})-(\d{2})-(\d{2})(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$)/.exec(value);
    if (!match) pricingError('INVALID_STAY_DATES');
    const time = /T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value);
    if (time && (Number(time[1]) > 23 || Number(time[2]) > 59 || Number(time[3] ?? 0) > 59)) pricingError('INVALID_STAY_DATES');
    const calendar = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (calendar.getUTCFullYear() !== Number(match[1]) || calendar.getUTCMonth() + 1 !== Number(match[2]) || calendar.getUTCDate() !== Number(match[3])) pricingError('INVALID_STAY_DATES');
  }
  const checkInDate = normalizeHotelCheckIn(input.checkInDate);
  const checkOutDate = normalizeHotelCheckOut(input.checkOutDate);
  if (!Number.isFinite(checkInDate.getTime()) || !Number.isFinite(checkOutDate.getTime()) || checkOutDate <= checkInDate) pricingError('INVALID_STAY_DATES');
  return { checkInDate, checkOutDate, nights: calcNights(input.checkInDate, input.checkOutDate) };
}

export function hotelIso(value: Date) {
  return new Date(value.getTime() + 7 * 3600000).toISOString().replace('Z', '+07:00');
}

export function calculatePrice(baseValue: Prisma.Decimal, discountValue: Prisma.Decimal, nights: number) {
  const base = new Prisma.Decimal(baseValue);
  const discount = new Prisma.Decimal(discountValue);
  if (!base.isFinite() || base.lte(0) || !discount.isFinite() || discount.lt(0) || discount.gte(base)) pricingError('INVALID_DISCOUNT_CONFIGURATION');
  const final = base.minus(discount);
  const total = final.times(nights);
  if (total.gt('9999999999.99')) pricingError('INVALID_DISCOUNT_CONFIGURATION');
  return { basePricePerNight: base.toNumber(), discountPerNight: discount.toNumber(), finalPricePerNight: final.toNumber(), totalDiscount: discount.times(nights).toNumber(), total: total.toNumber() };
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async calculate(tx: Prisma.TransactionClient, input: PriceCheckDto) {
    const stay = normalizeStay(input);
    const room = await tx.room.findUnique({ where: { id: input.roomId }, include: { roomType: true } });
    if (!room || room.deletedAt) pricingError('ROOM_NOT_FOUND', 404);
    if (!room.isActive) pricingError('ROOM_NOT_ACTIVE');
    if (room.status === RoomStatus.MAINTENANCE) pricingError('ROOM_MAINTENANCE');
    const conflict = await tx.reservation.findFirst({ where: {
      roomId: input.roomId, deletedAt: null, status: { not: ReservationStatus.CANCELLED },
      checkInDate: { lt: stay.checkOutDate }, checkOutDate: { gt: stay.checkInDate },
    } });
    if (conflict) pricingError('ROOM_NO_LONGER_AVAILABLE', 409);
    const hold = await tx.roomHold.findFirst({ where: {
      roomId: input.roomId, ...activeHoldWhere(), checkInDate: { lt: stay.checkOutDate }, checkOutDate: { gt: stay.checkInDate },
    } });
    if (hold) pricingError('ROOM_TEMPORARILY_HELD', 409);
    const rules = input.discount === 'yes' ? await tx.roomTypeStayDiscountRule.findMany({ where: {
      roomTypeId: room.roomTypeId, isActive: true, minNights: { lte: stay.nights }, OR: [{ maxNights: null }, { maxNights: { gte: stay.nights } }],
    } }) : [];
    if (rules.length > 1) pricingError('INVALID_DISCOUNT_CONFIGURATION');
    const rule = rules[0];
    const pricing = calculatePrice(room.price ?? room.roomType.basePrice, rule?.discountPerNight ?? new Prisma.Decimal(0), stay.nights);
    return {
      available: true,
      room: { roomId: room.id, roomCode: room.number, roomTypeId: room.roomTypeId, roomTypeName: room.roomType.name },
      stay: { checkInDate: hotelIso(stay.checkInDate), checkOutDate: hotelIso(stay.checkOutDate), nights: stay.nights },
      pricing: { priceSource: room.price == null ? 'ROOM_TYPE_BASE_PRICE' : 'ROOM_PRICE', discountRequested: input.discount === 'yes', discountApplied: pricing.discountPerNight > 0, discountRuleId: rule?.id ?? null, ...pricing, currency: 'VND' },
    };
  }

  check(input: PriceCheckDto) {
    return this.prisma.$transaction((tx) => this.calculate(tx, input), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

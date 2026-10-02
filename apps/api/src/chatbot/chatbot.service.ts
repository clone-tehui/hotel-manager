import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryLockService } from '../pricing/inventory-lock.service';
import { PricingService, hotelIso } from '../pricing/pricing.service';
import { pricingError } from '../pricing/pricing-error';
import { BookingFromHoldDto, CreateHoldDto } from './chatbot.dto';
import { ChatbotIdempotencyService } from './chatbot-idempotency.service';
import { CustomerContextService, normalizePhone } from './customer-context.service';
import { ReservationsService } from '../reservations/reservations.service';

const holdInclude = { room: { include: { roomType: true } } } as const;

@Injectable()
export class ChatbotService {
  constructor(private readonly prisma: PrismaService, private readonly inventory: InventoryLockService, private readonly pricing: PricingService, private readonly idempotency: ChatbotIdempotencyService, private readonly customers: CustomerContextService, private readonly reservations: ReservationsService) {}

  private projectHold(hold: Prisma.RoomHoldGetPayload<{ include: typeof holdInclude }>) {
    return { holdId: hold.id, status: hold.status === 'ACTIVE' && hold.expiresAt <= new Date() ? 'EXPIRED' : hold.status, expiresAt: hotelIso(hold.expiresAt),
      room: { roomId: hold.roomId, roomCode: hold.room.number, roomTypeId: hold.room.roomTypeId, roomTypeName: hold.room.roomType.name },
      stay: { checkInDate: hotelIso(hold.checkInDate), checkOutDate: hotelIso(hold.checkOutDate), nights: hold.totalNightsSnapshot },
      pricing: { basePricePerNight: Number(hold.basePricePerNightSnapshot), discountRequested: hold.discountRequested, discountApplied: Number(hold.discountPerNightSnapshot) > 0, discountRuleId: hold.discountRuleIdSnapshot, discountPerNight: Number(hold.discountPerNightSnapshot), finalPricePerNight: Number(hold.finalPricePerNightSnapshot), totalDiscount: Number(hold.totalDiscountSnapshot), total: Number(hold.totalAmountSnapshot), currency: 'VND' },
    };
  }

  createHold(apiKeyId: string, key: unknown, input: CreateHoldDto) {
    return this.idempotency.execute(apiKeyId, 'CREATE_HOLD', key, input, async (tx) => {
      await this.inventory.rooms(tx, [input.roomId]);
      const quote = await this.pricing.calculate(tx, input);
      const ttl = Number(process.env.CHATBOT_HOLD_TTL_MINUTES ?? 15);
      if (!Number.isFinite(ttl) || ttl < 1 || ttl > 1440) pricingError('INVALID_HOLD_CONFIGURATION');
      const price = quote.pricing;
      const hold = await tx.roomHold.create({ data: {
        apiKeyId, roomId: input.roomId, checkInDate: new Date(quote.stay.checkInDate), checkOutDate: new Date(quote.stay.checkOutDate),
        discountRequested: price.discountRequested, basePricePerNightSnapshot: price.basePricePerNight, discountRuleIdSnapshot: price.discountRuleId,
        discountPerNightSnapshot: price.discountPerNight, finalPricePerNightSnapshot: price.finalPricePerNight, totalNightsSnapshot: quote.stay.nights,
        totalDiscountSnapshot: price.totalDiscount, totalAmountSnapshot: price.total, customerRef: input.customerRef, conversationRef: input.conversationRef, channelType: input.channelType, externalThreadId: input.externalThreadId,
        expiresAt: new Date(Date.now() + ttl * 60000),
      }, include: holdInclude });
      return this.projectHold(hold);
    });
  }

  async getHold(apiKeyId: string, id: string) {
    const hold = await this.prisma.roomHold.findFirst({ where: { id, apiKeyId }, include: holdInclude });
    if (!hold) pricingError('HOLD_NOT_FOUND', 404);
    return this.projectHold(hold);
  }

  release(apiKeyId: string, key: unknown, holdId: string) {
    return this.idempotency.execute(apiKeyId, 'RELEASE_HOLD', key, { holdId }, async (tx) => {
      let hold = await tx.roomHold.findFirst({ where: { id: holdId, apiKeyId } });
      if (!hold) pricingError('HOLD_NOT_FOUND', 404);
      await this.inventory.rooms(tx, [hold.roomId]);
      hold = await tx.roomHold.findUnique({ where: { id: holdId } });
      if (hold.status === 'CONVERTED') pricingError('HOLD_ALREADY_CONVERTED', 409);
      if (hold.status === 'ACTIVE' && hold.expiresAt <= new Date()) pricingError('HOLD_EXPIRED', 409);
      if (hold.status === 'ACTIVE') hold = await tx.roomHold.update({ where: { id: holdId }, data: { status: 'RELEASED', releasedAt: new Date() } });
      return { holdId, status: hold.status, releasedAt: hold.releasedAt ? hotelIso(hold.releasedAt) : null };
    });
  }

  book(apiKeyId: string, key: unknown, input: BookingFromHoldDto) {
    if ((!input.guestId && !input.guest) || (input.guestId && input.guest)) pricingError('INVALID_GUEST_INPUT');
    let createdId: string | undefined;
    return this.idempotency.execute(apiKeyId, 'BOOKING_FROM_HOLD', key, input, async (tx) => {
      let hold = await tx.roomHold.findFirst({ where: { id: input.holdId, apiKeyId }, include: holdInclude });
      if (!hold) pricingError('HOLD_NOT_FOUND', 404);
      await this.inventory.rooms(tx, [hold.roomId]);
      hold = await tx.roomHold.findUnique({ where: { id: input.holdId }, include: holdInclude });
      if (hold.status === 'CONVERTED') pricingError('HOLD_ALREADY_CONVERTED', 409);
      if (hold.status === 'RELEASED') pricingError('HOLD_RELEASED', 409);
      if (hold.status !== 'ACTIVE' || hold.expiresAt <= new Date()) pricingError('HOLD_EXPIRED', 409);
      await this.inventory.assertAvailable(tx, hold.roomId, hold.checkInDate, hold.checkOutDate, undefined, hold.id);
      const identities = input.guestId ? { guestId: input.guestId } : { phone: input.guest.phone ? normalizePhone(input.guest.phone) : undefined, email: input.guest.email?.trim().toLowerCase(), idNumber: input.guest.idNumber?.trim() };
      for (const identity of Object.entries(identities).filter(([, value]) => value).map(([field, value]) => `${field}:${value}`).sort()) await this.inventory.lock(tx, `hotel-guest:${identity}`);
      const match = await this.customers.match(tx, identities);
      if (match.matchStatus === 'AMBIGUOUS') pricingError('CUSTOMER_AMBIGUOUS', 409);
      if (input.guestId && !match.guest) pricingError('GUEST_NOT_FOUND', 404);
      const guest = match.guest ?? await tx.guest.create({ data: { ...input.guest, phone: identities.phone, email: identities.email, idNumber: identities.idNumber } });
      const source = hold.channelType?.startsWith('zalo') ? 'zalo' : 'khac';
      const reservation = await tx.reservation.create({ data: {
        reservationCode: `RES${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${randomBytes(8).toString('hex').toUpperCase()}`,
        roomId: hold.roomId, primaryGuestName: guest.fullName, checkInDate: hold.checkInDate, checkOutDate: hold.checkOutDate,
        adults: input.adults ?? 1, children: input.children ?? 0, pricePerNight: hold.basePricePerNightSnapshot, discountAmount: hold.totalDiscountSnapshot, totalNights: hold.totalNightsSnapshot, totalAmount: hold.totalAmountSnapshot,
        status: 'BOOKED', source, threadId: source === 'zalo' ? hold.externalThreadId : null, notes: input.notes,
        guests: { create: { guestId: guest.id, isPrimary: true } }, logs: { create: { action: 'CREATED_FROM_HOLD', newValue: { holdId: hold.id } } },
      } });
      await tx.room.update({ where: { id: hold.roomId }, data: { status: 'RESERVED' } });
      await tx.roomHold.update({ where: { id: hold.id }, data: { status: 'CONVERTED', convertedAt: new Date(), reservationId: reservation.id } });
      createdId = reservation.id;
      const projection = this.projectHold(hold);
      return { reservationId: reservation.id, reservationCode: reservation.reservationCode, status: reservation.status, holdId: hold.id, room: projection.room, stay: projection.stay, pricing: projection.pricing };
    }).then(async (response) => {
      if (createdId) await this.reservations.announceCreated(createdId);
      return response;
    });
  }

  async booking(apiKeyId: string, reservationId: string) {
    const hold = await this.prisma.roomHold.findFirst({ where: { apiKeyId, reservationId, status: 'CONVERTED' } });
    if (!hold) pricingError('RESERVATION_NOT_FOUND', 404);
    const reservation = await this.prisma.reservation.findFirst({ where: { id: reservationId, deletedAt: null }, include: { room: { include: { building: true, roomType: true } }, guests: { where: { isPrimary: true }, include: { guest: true } } } });
    if (!reservation) pricingError('RESERVATION_NOT_FOUND', 404);
    const guest = reservation.guests[0]?.guest;
    return { reservationId, reservationCode: reservation.reservationCode, status: reservation.status,
      room: { roomId: reservation.roomId, roomCode: reservation.room.number, buildingName: reservation.room.building.name, roomTypeName: reservation.room.roomType.name },
      checkInDate: hotelIso(reservation.checkInDate), checkOutDate: hotelIso(reservation.checkOutDate), nights: reservation.totalNights,
      guest: guest ? { guestId: guest.id, fullName: guest.fullName, phone: guest.phone, email: guest.email } : null,
      pricing: { basePricePerNight: Number(reservation.pricePerNight), totalDiscount: Number(reservation.discountAmount), total: Number(reservation.totalAmount), currency: 'VND' },
    };
  }
}

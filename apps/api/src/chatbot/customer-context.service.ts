import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerContextDto } from './chatbot.dto';
import { pricingError } from '../pricing/pricing-error';
import { hotelIso } from '../pricing/pricing.service';

export function normalizePhone(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  if (!/^\d{7,15}$/.test(digits)) pricingError('INVALID_CUSTOMER_IDENTIFIER');
  return digits.startsWith('0') ? `84${digits.slice(1)}` : digits;
}

@Injectable()
export class CustomerContextService {
  constructor(private readonly prisma: PrismaService) {}

  async match(tx: Prisma.TransactionClient, input: CustomerContextDto) {
    const results: string[][] = [];
    if (input.guestId) results.push((await tx.guest.findMany({ where: { id: input.guestId.trim() }, select: { id: true } })).map((guest) => guest.id));
    if (input.idNumber) results.push((await tx.guest.findMany({ where: { idNumber: input.idNumber.trim() }, select: { id: true } })).map((guest) => guest.id));
    if (input.email) {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM guests WHERE lower(trim(email)) = ${input.email.trim().toLowerCase()}`;
      results.push(rows.map((guest) => guest.id));
    }
    if (input.phone) {
      const phone = normalizePhone(input.phone);
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM guests WHERE (CASE WHEN regexp_replace(phone, '[^0-9]', '', 'g') LIKE '0%' THEN '84' || substring(regexp_replace(phone, '[^0-9]', '', 'g') FROM 2) ELSE regexp_replace(phone, '[^0-9]', '', 'g') END) = ${phone}`;
      results.push(rows.map((guest) => guest.id));
    }
    if (input.reservationCode) {
      const reservation = await tx.reservation.findUnique({ where: { reservationCode: input.reservationCode.trim() }, include: { guests: true } });
      results.push(reservation && !reservation.deletedAt ? reservation.guests.filter((link) => link.isPrimary).map((link) => link.guestId) : []);
    }
    const ids = [...new Set(results.flat())];
    const ambiguous = ids.length > 1 || (ids.length === 1 && results.some((result) => result.length !== 1 || result[0] !== ids[0]));
    if (ambiguous) return { matchStatus: 'AMBIGUOUS' as const, guest: null };
    if (!ids.length) return { matchStatus: 'NONE' as const, guest: null };
    return { matchStatus: 'MATCHED' as const, guest: await tx.guest.findUnique({ where: { id: ids[0] } }) };
  }

  context(input: CustomerContextDto) {
    if (!Object.values(input).some((value) => typeof value === 'string' && value.trim())) pricingError('CUSTOMER_IDENTIFIER_REQUIRED');
    return this.prisma.$transaction(async (tx) => {
      const match = await this.match(tx, input);
      const empty = { ...match, relationship: match.matchStatus === 'AMBIGUOUS' ? null : 'PROSPECT', currentReservations: [], upcomingReservations: [], pastReservationCount: 0 };
      if (!match.guest) return empty;
      const bookings = await tx.reservation.findMany({ where: { deletedAt: null, guests: { some: { guestId: match.guest.id } } }, include: { room: true } });
      const project = (booking: typeof bookings[number]) => ({ reservationId: booking.id, reservationCode: booking.reservationCode, roomId: booking.roomId, roomCode: booking.room.number, checkInDate: hotelIso(booking.checkInDate), checkOutDate: hotelIso(booking.checkOutDate), status: booking.status });
      const currentReservations = bookings.filter((booking) => booking.status === ReservationStatus.IN_HOUSE).map(project);
      const upcomingReservations = bookings.filter((booking) => ['PENDING', 'BOOKED', 'PENDING_CHECKIN'].includes(booking.status) && booking.checkOutDate > new Date()).map(project);
      const pastReservationCount = bookings.filter((booking) => booking.status === ReservationStatus.CHECKED_OUT).length;
      const { id, fullName, phone, email, isVip } = match.guest;
      return { matchStatus: match.matchStatus, relationship: currentReservations.length ? 'IN_HOUSE' : upcomingReservations.length ? 'BOOKED' : pastReservationCount ? 'PAST_GUEST' : 'PROSPECT', guest: { id, fullName, phone, email, isVip }, currentReservations, upcomingReservations, pastReservationCount };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}

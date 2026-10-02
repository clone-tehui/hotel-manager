import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus, RoomStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { pricingError } from './pricing-error';

export const activeHoldWhere = (now = new Date()) => ({ status: 'ACTIVE' as const, expiresAt: { gt: now } });

@Injectable()
export class InventoryLockService {
  constructor(private readonly prisma: PrismaService) {}

  async lock(tx: Prisma.TransactionClient, key: string) {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))::text`;
  }

  async rooms(tx: Prisma.TransactionClient, roomIds: string[]) {
    for (const roomId of [...new Set(roomIds)].filter(Boolean).sort()) await this.lock(tx, `hotel-room:${roomId}`);
  }

  transaction<Result>(callback: (tx: Prisma.TransactionClient) => Promise<Result>) {
    return this.prisma.$transaction(callback, { maxWait: 10000, timeout: 30000 });
  }

  async reservation<Result>(id: string, targetRoomId: string | undefined, callback: (tx: Prisma.TransactionClient) => Promise<Result>) {
    return this.transaction(async (tx) => {
      await this.lock(tx, `hotel-reservation:${id}`);
      const reservation = await tx.reservation.findUnique({ where: { id } });
      if (!reservation || reservation.deletedAt) pricingError('RESERVATION_NOT_FOUND', 404);
      await this.rooms(tx, [reservation.roomId, targetRoomId]);
      return callback(tx);
    });
  }

  async assertAvailable(tx: Prisma.TransactionClient, roomId: string, checkInDate: Date, checkOutDate: Date, excludeReservationId?: string, excludeHoldId?: string) {
    const room = await tx.room.findUnique({ where: { id: roomId }, include: { roomType: true } });
    if (!room || room.deletedAt) pricingError('ROOM_NOT_FOUND', 404);
    if (!room.isActive) pricingError('ROOM_NOT_ACTIVE');
    if (room.status === RoomStatus.MAINTENANCE) pricingError('ROOM_MAINTENANCE');
    const conflict = await tx.reservation.findFirst({ where: {
      roomId, deletedAt: null, status: { not: ReservationStatus.CANCELLED },
      ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      checkInDate: { lt: checkOutDate }, checkOutDate: { gt: checkInDate },
    } });
    if (conflict) pricingError('ROOM_NO_LONGER_AVAILABLE', 409);
    await this.assertNoHold(tx, roomId, checkInDate, checkOutDate, excludeHoldId);
    return room;
  }

  async assertNoHold(tx: Prisma.TransactionClient, roomId: string, checkInDate: Date, checkOutDate: Date, excludeHoldId?: string) {
    const hold = await tx.roomHold.findFirst({ where: {
      roomId, ...activeHoldWhere(), ...(excludeHoldId ? { id: { not: excludeHoldId } } : {}),
      checkInDate: { lt: checkOutDate }, checkOutDate: { gt: checkInDate },
    } });
    if (hold) pricingError('ROOM_TEMPORARILY_HELD', 409);
  }
}

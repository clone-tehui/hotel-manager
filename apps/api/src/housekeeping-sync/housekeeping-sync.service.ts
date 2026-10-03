import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, RoomStatus } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';

const ROOM_SELECT = {
  id: true,
  number: true,
  floor: true,
  status: true,
  isActive: true,
  deletedAt: true,
  updatedAt: true,
  building: { select: { id: true, code: true, name: true } },
} as const;

const RESERVATION_SELECT = {
  id: true,
  reservationCode: true,
  roomId: true,
  status: true,
  checkInDate: true,
  checkOutDate: true,
  actualCheckIn: true,
  actualCheckOut: true,
  updatedAt: true,
  room: { select: ROOM_SELECT },
} as const;

@Injectable()
export class HousekeepingSyncService {
  constructor(private readonly prisma: PrismaService, private readonly eventEmitter: EventEmitter2) {}

  private parseCursor(value?: string) {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('updatedSince phải là ISO datetime hợp lệ');
    return date;
  }

  private projectRoom(room: any) {
    return {
      id: room.id,
      roomId: room.id,
      roomCode: room.number,
      number: room.number,
      floor: room.floor,
      status: room.status,
      roomStatus: room.status,
      isActive: room.isActive && !room.deletedAt,
      buildingId: room.building?.id ?? null,
      buildingCode: room.building?.code ?? null,
      buildingName: room.building?.name ?? null,
      building: room.building ?? null,
      updatedAt: room.updatedAt,
    };
  }

  private projectReservation(reservation: any) {
    return {
      id: reservation.id,
      reservationId: reservation.id,
      reservationCode: reservation.reservationCode,
      roomId: reservation.roomId,
      status: reservation.status,
      scheduledCheckIn: reservation.checkInDate,
      scheduledCheckOut: reservation.checkOutDate,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      actualCheckIn: reservation.actualCheckIn,
      actualCheckOut: reservation.actualCheckOut,
      updatedAt: reservation.updatedAt,
      room: reservation.room ? this.projectRoom(reservation.room) : null,
    };
  }

  async snapshot(updatedSince?: string) {
    const since = this.parseCursor(updatedSince);
    const cursor = new Date();
    const yesterday = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);

    const [rooms, reservations] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where: {
          ...(since ? { updatedAt: { gt: since, lte: cursor } } : {}),
        },
        select: ROOM_SELECT,
        orderBy: { updatedAt: 'asc' },
      }),
      this.prisma.reservation.findMany({
        where: {
          deletedAt: null,
          ...(since
            ? { updatedAt: { gt: since, lte: cursor } }
            : {
                OR: [
                  { checkOutDate: { gte: yesterday } },
                  { actualCheckOut: { gte: yesterday } },
                  { status: { in: [ReservationStatus.BOOKED, ReservationStatus.PENDING_CHECKIN, ReservationStatus.IN_HOUSE] } },
                ],
              }),
        },
        select: RESERVATION_SELECT,
        orderBy: { updatedAt: 'asc' },
      }),
    ]);

    return {
      ok: true,
      data: {
        cursor: cursor.toISOString(),
        rooms: rooms.map((room) => this.projectRoom(room)),
        reservations: reservations.map((reservation) => this.projectReservation(reservation)),
      },
    };
  }

  async room(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: ROOM_SELECT });
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    return { ok: true, data: this.projectRoom(room) };
  }

  async cleaningApproved(
    roomId: string,
    input: { taskId: string; taskCode: string; approvedAt: string },
  ) {
    const room = await this.prisma.room.findFirst({
      where: { id: roomId, deletedAt: null, isActive: true },
      select: ROOM_SELECT,
    });
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    if (room.status === RoomStatus.MAINTENANCE) {
      throw new ConflictException('ROOM_UNDER_MAINTENANCE');
    }

    const approvedAt = new Date(input.approvedAt);
    if (Number.isNaN(approvedAt.getTime())) {
      throw new BadRequestException('approvedAt phải là ISO datetime hợp lệ');
    }
    if (room.updatedAt.getTime() > approvedAt.getTime()) {
      throw new ConflictException('STALE_CLEANING_APPROVAL');
    }

    const now = new Date();
    const [inHouse, nextReservation] = await this.prisma.$transaction([
      this.prisma.reservation.findFirst({
        where: {
          roomId,
          deletedAt: null,
          status: ReservationStatus.IN_HOUSE,
        },
        select: { id: true },
      }),
      this.prisma.reservation.findFirst({
        where: {
          roomId,
          deletedAt: null,
          status: { in: [ReservationStatus.BOOKED, ReservationStatus.PENDING_CHECKIN] },
          checkInDate: { gt: now },
        },
        select: { id: true, checkInDate: true },
        orderBy: { checkInDate: 'asc' },
      }),
    ]);

    if (inHouse || room.status === RoomStatus.OCCUPIED) {
      throw new ConflictException('ROOM_ALREADY_OCCUPIED');
    }

    const targetStatus = nextReservation ? RoomStatus.RESERVED : RoomStatus.VACANT;
    const updated = room.status === targetStatus
      ? room
      : await this.prisma.room.update({
          where: { id: roomId },
          data: { status: targetStatus },
          select: ROOM_SELECT,
        });

    if (room.status !== targetStatus) {
      this.eventEmitter.emit('room.status_changed', {
        id: updated.id,
        roomId: updated.id,
        number: updated.number,
        floor: updated.floor,
        status: updated.status,
        isActive: updated.isActive,
        updatedAt: updated.updatedAt,
        building: updated.building,
        housekeeping: {
          taskId: input.taskId,
          taskCode: input.taskCode,
          approvedAt: input.approvedAt,
        },
      });
    }

    return {
      ok: true,
      data: {
        room: this.projectRoom(updated),
        cleaningApproval: {
          taskId: input.taskId,
          taskCode: input.taskCode,
          approvedAt: input.approvedAt,
        },
      },
    };
  }

  async reservation(reservationId: string) {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id: reservationId },
      select: {
        ...RESERVATION_SELECT,
        logs: {
          where: { action: 'ROOM_CHANGED' },
          select: { id: true, oldValue: true, newValue: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!reservation) throw new NotFoundException('RESERVATION_NOT_FOUND');
    return { ok: true, data: { ...this.projectReservation(reservation), roomChangeLogs: reservation.logs } };
  }

  async nextTurnover(roomId: string) {
    const room = await this.prisma.room.findUnique({ where: { id: roomId }, select: ROOM_SELECT });
    if (!room) throw new NotFoundException('ROOM_NOT_FOUND');
    const now = new Date();
    const [currentOrLast, next] = await this.prisma.$transaction([
      this.prisma.reservation.findFirst({
        where: { roomId, deletedAt: null, status: { not: ReservationStatus.CANCELLED }, checkOutDate: { lte: now } },
        select: RESERVATION_SELECT,
        orderBy: { checkOutDate: 'desc' },
      }),
      this.prisma.reservation.findFirst({
        where: { roomId, deletedAt: null, status: { not: ReservationStatus.CANCELLED }, checkInDate: { gt: now } },
        select: RESERVATION_SELECT,
        orderBy: { checkInDate: 'asc' },
      }),
    ]);
    return {
      ok: true,
      data: {
        room: this.projectRoom(room),
        previousOrCurrentReservation: currentOrLast ? this.projectReservation(currentOrLast) : null,
        nextReservation: next ? this.projectReservation(next) : null,
      },
    };
  }

  async health() {
    const [latestRoom, latestReservation] = await this.prisma.$transaction([
      this.prisma.room.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.reservation.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
    ]);
    return {
      ok: true,
      data: {
        service: 'housekeeping-sync',
        time: new Date().toISOString(),
        latestRoomUpdatedAt: latestRoom?.updatedAt ?? null,
        latestReservationUpdatedAt: latestReservation?.updatedAt ?? null,
      },
    };
  }
}

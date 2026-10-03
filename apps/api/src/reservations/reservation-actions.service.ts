import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, RoomStatus } from '@prisma/client';
import axios from 'axios';
import { InventoryLockService } from '../pricing/inventory-lock.service';
import { Prisma } from '@prisma/client';
import { CancelReservationDto } from './dto/cancel-reservation.dto';
import { AssignRoomDto } from './dto/assign-room.dto';
import { ChangeRoomDto } from './dto/change-room.dto';
import { CheckInDto } from './dto/check-in.dto';
import { CheckOutDto } from './dto/check-out.dto';
import { ExtendReservationDto } from './dto/extend-reservation.dto';
import { EventEmitter2 } from '@nestjs/event-emitter';

/** Statuses considered "active" – used for conflict detection */
const ACTIVE: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.PENDING_CHECKIN,
  ReservationStatus.IN_HOUSE,
];

const HOTEL_CHECKOUT_HOUR = 12;
const HOTEL_TIMEZONE_OFFSET_HOURS = 7;
const BOOKING_CREATED_WEBHOOK_URL = 'https://chiemtain8n.xiaomichinhhang.vn/webhook/bookingchihome';
const BOOKING_AUTOMATION_WEBHOOK_URL = String(process.env.BOOKING_AUTOMATION_WEBHOOK_URL || process.env.ZALO_USER_SERVER_BOOKING_WEBHOOK_URL || '').trim();
const BOOKING_AUTOMATION_WEBHOOK_SECRET = String(process.env.BOOKING_AUTOMATION_WEBHOOK_SECRET || process.env.CHIHOME_BOOKING_BRIDGE_SECRET || '').trim();

function createHotelDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - HOTEL_TIMEZONE_OFFSET_HOURS, minute, second, 0));
}

function parseInputDate(input: string | Date): Date {
  if (input instanceof Date) return new Date(input.getTime());

  const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, m, d] = dateOnlyMatch;
    return createHotelDate(Number(y), Number(m), Number(d));
  }

  const localDateTimeMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (localDateTimeMatch) {
    const [, y, m, d, hh, mm, ss] = localDateTimeMatch;
    return createHotelDate(Number(y), Number(m), Number(d), Number(hh), Number(mm), Number(ss ?? '0'));
  }

  return new Date(input);
}

function hasExplicitTime(input: string | Date): boolean {
  if (input instanceof Date) return true;
  return /T\d{2}:\d{2}/.test(input);
}

function normalizeHotelCheckOut(input: string | Date): Date {
  const d = parseInputDate(input);
  if (!hasExplicitTime(input)) d.setHours(HOTEL_CHECKOUT_HOUR, 0, 0, 0);
  return d;
}

function formatHotelDateTime(value: string | Date | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('vi-VN', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(date);

  const pick = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('hour')}:${pick('minute')} ${pick('day')}/${pick('month')}/${pick('year')}`;
}

function normalizeActorUserId(userId?: string): string | undefined {
  const normalized = String(userId || '').trim();
  if (!normalized || normalized.startsWith('api-key:')) return undefined;
  return normalized;
}

const INCLUDE = {
  room: {
    select: {
      id: true, number: true, floor: true, status: true, buildingId: true, roomTypeId: true,
      roomType: { select: { name: true, basePrice: true } },
      building: { select: { id: true, code: true, name: true } },
    },
  },
  guests: { include: { guest: { select: { id: true, fullName: true, phone: true } } } },
  payments: { select: { id: true, amount: true, method: true, paidAt: true } },
};

async function postBookingWebhook(url: string, payload: any) {
  if (!url) return;
  await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      ...(BOOKING_AUTOMATION_WEBHOOK_SECRET ? { 'x-booking-bridge-secret': BOOKING_AUTOMATION_WEBHOOK_SECRET } : {}),
    },
    timeout: 10000,
  });
}

@Injectable()
export class ReservationActionsService {
  private readonly logger = new Logger(ReservationActionsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly inventory: InventoryLockService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private withFormattedDates<T extends { checkInDate?: string | Date | null; checkOutDate?: string | Date | null }>(reservation: T): T & {
    checkInDateFormatted: string | null;
    checkOutDateFormatted: string | null;
  } {
    return {
      ...reservation,
      checkInDateFormatted: formatHotelDateTime(reservation.checkInDate),
      checkOutDateFormatted: formatHotelDateTime(reservation.checkOutDate),
    };
  }

  private async sendBookingWebhook(eventType: string, payload: any) {
    try {
      await postBookingWebhook(BOOKING_CREATED_WEBHOOK_URL, payload);
      if (BOOKING_AUTOMATION_WEBHOOK_URL) {
        await postBookingWebhook(BOOKING_AUTOMATION_WEBHOOK_URL, { eventType, reservation: payload });
      }
    } catch (error: any) {
      this.logger.warn(`Không gửi được webhook reservation action: ${error?.message ?? error}`);
    }
  }

  // ─────────────────────────── Private helpers ───────────────────────────────

  private async getOrThrow(id: string, database: Prisma.TransactionClient | PrismaService = this.prisma) {
    const res = await database.reservation.findUnique({ where: { id }, include: INCLUDE });
    if (!res) throw new NotFoundException(`Đặt phòng #${id} không tồn tại`);
    return res;
  }

  /** Throws ConflictException if the room already has an active booking overlapping the window */
  private async assertNoConflict(
    roomId: string,
    checkIn: Date,
    checkOut: Date,
    excludeId?: string,
    database: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    await this.inventory.assertNoHold(database as Prisma.TransactionClient, roomId, checkIn, checkOut);
    const hit = await database.reservation.findFirst({
      where: {
        roomId,
        deletedAt: null,
        status: { in: ACTIVE },
        id: excludeId ? { not: excludeId } : undefined,
        AND: [
          { checkInDate:  { lt: checkOut } },
          { checkOutDate: { gt: checkIn  } },
        ],
      },
    });
    if (hit) {
      const ci = hit.checkInDate.toLocaleDateString('vi-VN');
      const co = hit.checkOutDate.toLocaleDateString('vi-VN');
      throw new ConflictException(
        `Phòng đã bị chiếm bởi đặt phòng #${hit.reservationCode} (${ci} – ${co})`,
      );
    }
  }

  /** Loads a room and throws if not found or under maintenance */
  private async assertRoomUsable(roomId: string, database: Prisma.TransactionClient | PrismaService = this.prisma) {
    const room = await database.room.findUnique({ where: { id: roomId } });
    if (!room || !room.isActive) throw new NotFoundException('Phòng không tồn tại');
    if (room.status === RoomStatus.MAINTENANCE) {
      throw new BadRequestException(`Phòng ${room.number} đang bảo trì, không thể sử dụng`);
    }
    return room;
  }

  /**
   * Changing a room is scheduled by stay dates, not by today's housekeeping
   * status. For an existing active room, the only business constraint is an
   * overlapping active reservation (checked separately by assertNoConflict).
   */
  private async getRoomForDateBasedChange(roomId: string, database: Prisma.TransactionClient | PrismaService = this.prisma) {
    const room = await database.room.findFirst({
      where: { id: roomId, isActive: true, deletedAt: null },
    });
    if (!room) throw new NotFoundException('Phòng không tồn tại hoặc đã ngừng hoạt động');
    return room;
  }

  private log(action: string, userId: string | undefined, oldVal: object, newVal: object) {
    return { action, userId: normalizeActorUserId(userId), oldValue: oldVal as any, newValue: newVal as any };
  }

  // ───────────────────────────── CANCEL ─────────────────────────────────────
  async cancel(id: string, dto: CancelReservationDto, userId?: string) {
    const result = await this.inventory.reservation(id, undefined, async (tx) => {
    const res = await this.getOrThrow(id, tx);

    const allowed = ['PENDING', 'BOOKED', 'PENDING_CHECKIN'];
    if (!allowed.includes(res.status)) {
      throw new BadRequestException(
        `Không thể huỷ: trạng thái ${res.status} không hợp lệ (chỉ huỷ được ${allowed.join(' / ')})`,
      );
    }

    // Rule 7: cancel reason mandatory – already enforced by DTO @MinLength

    // Free the room back to VACANT if assigned
    if (res.roomId) {
      await tx.room.update({
        where: { id: res.roomId },
        data: { status: RoomStatus.VACANT },
      });
    }

    const cancelled = await tx.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CANCELLED,
        cancelReason: dto.cancelReason,
        cancelledAt: new Date(),
        logs: { create: this.log('CANCELLED', userId, { status: res.status }, { status: 'CANCELLED', cancelReason: dto.cancelReason }) },
      },
      include: INCLUDE,
    });

    const formattedCancelled = this.withFormattedDates(cancelled);
    return formattedCancelled;
    });
    this.eventEmitter.emit('reservation.cancelled', result);
    void this.sendBookingWebhook('reservation.cancelled', result);
    return result;
  }

  // ─────────────────────────── ASSIGN ROOM ──────────────────────────────────
  async assignRoom(id: string, dto: AssignRoomDto, userId?: string) {
    const result = await this.inventory.reservation(id, dto.roomId, async (tx) => {
    const res = await this.getOrThrow(id, tx);

    const allowed = ['PENDING', 'BOOKED'];
    if (!allowed.includes(res.status)) {
      throw new BadRequestException(
        `Chỉ gán phòng được khi trạng thái là ${allowed.join(' / ')} (hiện: ${res.status})`,
      );
    }

    // Rule 6: no maintenance rooms
    const room = await this.assertRoomUsable(dto.roomId, tx);

    // Rule 1: no overlap
    await this.assertNoConflict(dto.roomId, res.checkInDate, res.checkOutDate, id, tx);

    // Free old room if re-assigning
    if (res.roomId && res.roomId !== dto.roomId) {
      await tx.room.update({ where: { id: res.roomId }, data: { status: RoomStatus.VACANT } });
    }

    await tx.room.update({ where: { id: dto.roomId }, data: { status: RoomStatus.RESERVED } });

    const updated = await tx.reservation.update({
      where: { id },
      data: {
        roomId: dto.roomId,
        status: ReservationStatus.BOOKED,
        logs: {
          create: this.log(
            'ROOM_ASSIGNED', userId,
            { roomId: res.roomId },
            { roomId: dto.roomId, roomNumber: room.number },
          ),
        },
      },
      include: INCLUDE,
    });
    const formatted = this.withFormattedDates(updated);
    return formatted;
    });
    this.eventEmitter.emit('reservation.updated', result);
    void this.sendBookingWebhook('reservation.room_assigned', result);
    return result;
  }

  // ─────────────────────────── CHANGE ROOM ──────────────────────────────────
  async changeRoom(id: string, dto: ChangeRoomDto, userId?: string) {
    const result = await this.inventory.reservation(id, dto.newRoomId, async (tx) => {
    const res = await this.getOrThrow(id, tx);

    const allowed = ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'];
    if (!allowed.includes(res.status)) {
      throw new BadRequestException(`Không thể đổi phòng ở trạng thái ${res.status}`);
    }
    if (!res.roomId) {
      throw new BadRequestException('Đặt phòng chưa được gán phòng');
    }
    if (res.roomId === dto.newRoomId) {
      throw new BadRequestException('Phòng mới phải khác phòng hiện tại');
    }

    // A change-room is driven solely by date availability. Do not reject
    // VACANT / DIRTY / RESERVED / OCCUPIED / MAINTENANCE based on the room's
    // current operational status; assertNoConflict is the deciding rule.
    const newRoom = await this.getRoomForDateBasedChange(dto.newRoomId, tx);
    await this.assertNoConflict(dto.newRoomId, res.checkInDate, res.checkOutDate, id, tx);

    const isInHouse = res.status === ReservationStatus.IN_HOUSE;

    // Old room: if guest was in it → DIRTY; otherwise free it → VACANT
    await tx.room.update({
      where: { id: res.roomId },
      data: { status: isInHouse ? RoomStatus.DIRTY : RoomStatus.VACANT },
    });
    // New room: OCCUPIED if in-house, else RESERVED
    await tx.room.update({
      where: { id: dto.newRoomId },
      data: { status: isInHouse ? RoomStatus.OCCUPIED : RoomStatus.RESERVED },
    });

    const updated = await tx.reservation.update({
      where: { id },
      data: {
        roomId: dto.newRoomId,
        logs: {
          create: this.log(
            'ROOM_CHANGED', userId,
            { roomId: res.roomId },
            { roomId: dto.newRoomId, roomNumber: newRoom.number, reason: dto.reason },
          ),
        },
      },
      include: INCLUDE,
    });
    const formatted = this.withFormattedDates(updated);
    return formatted;
    });
    const roomChangeLog = await this.prisma.reservationLog.findFirst({
      where: { reservationId: id, action: 'ROOM_CHANGED' },
      select: { oldValue: true, newValue: true },
      orderBy: { createdAt: 'desc' },
    });
    const oldRoomId = (roomChangeLog?.oldValue as any)?.roomId ?? null;
    const newRoomId = (roomChangeLog?.newValue as any)?.roomId ?? result.roomId ?? null;
    const [oldRoom, newRoom] = await Promise.all([
      oldRoomId
        ? this.prisma.room.findUnique({
            where: { id: oldRoomId },
            select: { id: true, number: true, floor: true, status: true, updatedAt: true, building: { select: { id: true, code: true, name: true } } },
          })
        : Promise.resolve(null),
      newRoomId
        ? this.prisma.room.findUnique({
            where: { id: newRoomId },
            select: { id: true, number: true, floor: true, status: true, updatedAt: true, building: { select: { id: true, code: true, name: true } } },
          })
        : Promise.resolve(null),
    ]);
    this.eventEmitter.emit('reservation.room_changed', { ...result, oldRoom, newRoom });
    void this.sendBookingWebhook('reservation.room_changed', result);
    return result;
  }

  // ─────────────────────────── CHECK-IN ─────────────────────────────────────
  async checkIn(id: string, dto: CheckInDto, userId?: string) {
    const result = await this.inventory.reservation(id, undefined, async (tx) => {
    const res = await this.getOrThrow(id, tx);

    // Rule 2: must have a room
    if (!res.roomId) {
      throw new BadRequestException('Không thể check-in: đặt phòng chưa được gán phòng');
    }

    const allowed = ['BOOKED', 'PENDING_CHECKIN'];
    if (!allowed.includes(res.status)) {
      throw new BadRequestException(
        `Không thể check-in từ trạng thái ${res.status} (cần ${allowed.join(' / ')})`,
      );
    }

    const checkInTime = dto.actualCheckIn ? new Date(dto.actualCheckIn) : new Date();

    await tx.room.update({ where: { id: res.roomId }, data: { status: RoomStatus.OCCUPIED } });

    const updated = await tx.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.IN_HOUSE,
        actualCheckIn: checkInTime,
        logs: {
          create: this.log(
            'CHECKED_IN', userId,
            { status: res.status },
            { status: 'IN_HOUSE', actualCheckIn: checkInTime, notes: dto.notes },
          ),
        },
      },
      include: INCLUDE,
    });
    const formatted = this.withFormattedDates(updated);
    return formatted;
    });
    this.eventEmitter.emit('reservation.checked_in', result);
    void this.sendBookingWebhook('reservation.checked_in', result);
    return result;
  }

  // ─────────────────────────── CHECK-OUT ────────────────────────────────────
  async checkOut(id: string, dto: CheckOutDto, userId?: string) {
    const result = await this.inventory.reservation(id, undefined, async (tx) => {
    const res = await this.getOrThrow(id, tx);

    // Rule 3: must be IN_HOUSE
    if (res.status !== ReservationStatus.IN_HOUSE) {
      throw new BadRequestException(
        `Không thể check-out: trạng thái phải là IN_HOUSE (hiện: ${res.status})`,
      );
    }

    const checkOutTime = dto.actualCheckOut ? new Date(dto.actualCheckOut) : new Date();

    // Room → DIRTY after checkout (needs cleaning)
    await tx.room.update({ where: { id: res.roomId }, data: { status: RoomStatus.DIRTY } });

    const updated = await tx.reservation.update({
      where: { id },
      data: {
        status: ReservationStatus.CHECKED_OUT,
        actualCheckOut: checkOutTime,
        logs: {
          create: this.log(
            'CHECKED_OUT', userId,
            { status: res.status },
            { status: 'CHECKED_OUT', actualCheckOut: checkOutTime, notes: dto.notes },
          ),
        },
      },
      include: INCLUDE,
    });
    const formatted = this.withFormattedDates(updated);
    return formatted;
    });
    this.eventEmitter.emit('reservation.checked_out', result);
    void this.sendBookingWebhook('reservation.checked_out', result);
    return result;
  }

  // ─────────────────────────── EXTEND ───────────────────────────────────────
  async extend(id: string, dto: ExtendReservationDto, userId?: string) {
    const result = await this.inventory.reservation(id, undefined, async (tx) => {
    const res = await this.getOrThrow(id, tx);

    const allowed = ['BOOKED', 'PENDING_CHECKIN', 'IN_HOUSE'];
    if (!allowed.includes(res.status)) {
      throw new BadRequestException(`Không thể gia hạn ở trạng thái ${res.status}`);
    }

    const newCheckOut = normalizeHotelCheckOut(dto.newCheckOutDate);

    // Rule 5: newCheckOut > current checkout
    if (newCheckOut <= res.checkOutDate) {
      throw new BadRequestException(
        `Ngày checkout mới phải sau ngày hiện tại (${res.checkOutDate.toISOString().slice(0, 10)})`,
      );
    }
    if (newCheckOut <= res.checkInDate) {
      throw new BadRequestException('Ngày checkout phải sau ngày checkin');
    }

    // Rule 1: check conflict for the EXTENDED window only
    await this.assertNoConflict(res.roomId, res.checkOutDate, newCheckOut, id, tx);

    const newNights = Math.ceil(
      (newCheckOut.getTime() - res.checkInDate.getTime()) / 86_400_000,
    );
    const newTotal = Number(res.pricePerNight) * newNights - Number(res.discountAmount);

    const updated = await tx.reservation.update({
      where: { id },
      data: {
        checkOutDate: newCheckOut,
        totalNights: newNights,
        totalAmount: newTotal,
        logs: {
          create: this.log(
            'EXTENDED', userId,
            { checkOutDate: res.checkOutDate, totalNights: res.totalNights, totalAmount: res.totalAmount },
            { checkOutDate: newCheckOut, totalNights: newNights, totalAmount: newTotal, reason: dto.reason },
          ),
        },
      },
      include: INCLUDE,
    });
    const formatted = this.withFormattedDates(updated);
    return formatted;
    });
    this.eventEmitter.emit('reservation.updated', result);
    void this.sendBookingWebhook('reservation.extended', result);
    return result;
  }

  // ─────────────────────────── GET LOGS ─────────────────────────────────────
  async getLogs(id: string) {
    const exists = await this.prisma.reservation.findUnique({
      where: { id },
      select: { id: true, reservationCode: true },
    });
    if (!exists) throw new NotFoundException(`Đặt phòng #${id} không tồn tại`);

    return this.prisma.reservationLog.findMany({
      where: { reservationId: id },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, fullName: true, email: true, role: true } } },

    });
  }
}

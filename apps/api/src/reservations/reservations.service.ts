import {
  Injectable, NotFoundException, BadRequestException, ConflictException, Logger, InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import axios from 'axios';
import { InventoryLockService, activeHoldWhere } from '../pricing/inventory-lock.service';

import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationDto } from './dto/update-reservation.dto';
import { QueryReservationDto } from './dto/query-reservation.dto';
import { QueryQuickRoomSearchDto } from './dto/query-quick-room-search.dto';
import { paginate, paginatedResponse } from '../common/dto/pagination.dto';
import { RoomStatus, ReservationStatus } from '@prisma/client';

const HOTEL_CHECKIN_HOUR = 14;
const HOTEL_CHECKOUT_HOUR = 12;
const HOTEL_TIMEZONE_OFFSET_HOURS = 7;
const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.PENDING_CHECKIN,
  ReservationStatus.IN_HOUSE,
];
const BOOKING_CREATED_WEBHOOK_URL = 'https://chiemtain8n.xiaomichinhhang.vn/webhook/bookingchihome';
const BOOKING_AUTOMATION_WEBHOOK_URL = String(process.env.BOOKING_AUTOMATION_WEBHOOK_URL || process.env.ZALO_USER_SERVER_BOOKING_WEBHOOK_URL || '').trim();
const BOOKING_AUTOMATION_WEBHOOK_SECRET = String(process.env.BOOKING_AUTOMATION_WEBHOOK_SECRET || process.env.CHIHOME_BOOKING_BRIDGE_SECRET || '').trim();
const ZALO_USER_SERVER_BASE_URL = String(process.env.ZALO_USER_SERVER_BASE_URL || 'https://zl.tehui.io.vn').trim().replace(/\/$/, '');
const ZALO_THREAD_LOOKUP_SECRET = String(process.env.CHIHOME_BOOKING_BRIDGE_SECRET || process.env.ZALO_THREAD_LOOKUP_SECRET || '').trim();

const RES_INCLUDE = {
  room: { select: { id: true, number: true, floor: true, price: true, discountablePrice: true, buildingId: true, roomTypeId: true, roomType: { select: { name: true } }, building: { select: { id: true, code: true, name: true } } } },
  guests: { include: { guest: { select: { id: true, fullName: true, phone: true, email: true, gender: true, nationality: true } } } },
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

function generateCode(): string {
  const d = new Date();
  const dt = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `RES${dt}${rand}`;
}

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

export function normalizeHotelCheckIn(input: string | Date): Date {
  if (typeof input === 'string' && !hasExplicitTime(input)) {
    const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      return createHotelDate(Number(y), Number(m), Number(d), HOTEL_CHECKIN_HOUR, 0, 0);
    }
  }

  const d = parseInputDate(input);
  if (!hasExplicitTime(input)) d.setHours(HOTEL_CHECKIN_HOUR, 0, 0, 0);
  return d;
}

export function normalizeHotelCheckOut(input: string | Date): Date {
  if (typeof input === 'string' && !hasExplicitTime(input)) {
    const dateOnlyMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnlyMatch) {
      const [, y, m, d] = dateOnlyMatch;
      return createHotelDate(Number(y), Number(m), Number(d), HOTEL_CHECKOUT_HOUR, 0, 0);
    }
  }

  const d = parseInputDate(input);
  if (!hasExplicitTime(input)) d.setHours(HOTEL_CHECKOUT_HOUR, 0, 0, 0);
  return d;
}

function formatHotelDate(value: Date) {
  const shifted = new Date(value.getTime() + HOTEL_TIMEZONE_OFFSET_HOURS * 60 * 60 * 1000);
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}`;
}

export function calcNights(checkIn: string, checkOut: string): number {
  const diff = normalizeHotelCheckOut(checkOut).getTime() - normalizeHotelCheckIn(checkIn).getTime();
  const nights = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (nights < 1) throw new BadRequestException('Ngày trả phòng phải sau ngày nhận phòng ít nhất 1 đêm');
  return nights;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
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

function normalizePhoneDigits(value: string): string {
  return String(value || '').replace(/\D+/g, '');
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private prisma: PrismaService,
    private readonly inventory: InventoryLockService,
    private eventEmitter: EventEmitter2
  ) { }

  private withFormattedDates<T extends {
    checkInDate?: string | Date | null;
    checkOutDate?: string | Date | null;
    guests?: Array<{ isPrimary?: boolean; guest?: { nationality?: string | null } | null }>;
  }>(reservation: T): T & {
    checkInDateFormatted: string | null;
    checkOutDateFormatted: string | null;
    primaryGuestNationality: string | null;
  } {
    const primaryGuestProfile = reservation.guests?.find((item) => item.isPrimary)?.guest
      ?? reservation.guests?.[0]?.guest;

    return {
      ...reservation,
      checkInDateFormatted: formatHotelDateTime(reservation.checkInDate),
      checkOutDateFormatted: formatHotelDateTime(reservation.checkOutDate),
      primaryGuestNationality: primaryGuestProfile?.nationality?.trim() || null,
    };
  }

  private async sendBookingWebhook(eventType: string, payload: any) {
    try {
      await postBookingWebhook(BOOKING_CREATED_WEBHOOK_URL, payload);
      if (BOOKING_AUTOMATION_WEBHOOK_URL) {
        await postBookingWebhook(BOOKING_AUTOMATION_WEBHOOK_URL, {
          eventType,
          reservation: payload,
        });
      }
    } catch (error: any) {
      this.logger.warn(`Không gửi được webhook booking ${eventType}: ${error?.message ?? error}`);
    }
  }

  async lookupZaloThreadByPhone(phone: string) {
    const normalizedPhone = normalizePhoneDigits(phone);
    if (!normalizedPhone || normalizedPhone.length < 8) {
      throw new BadRequestException('Số điện thoại không hợp lệ');
    }
    if (!ZALO_THREAD_LOOKUP_SECRET) {
      throw new InternalServerErrorException('Chưa cấu hình secret tra cứu Zalo thread');
    }

    try {
      const response = await axios.get(`${ZALO_USER_SERVER_BASE_URL}/api/chihome/resolve-thread`, {
        params: {
          phone: normalizedPhone,
          secret: ZALO_THREAD_LOOKUP_SECRET,
        },
        headers: {
          'x-chihome-bridge-secret': ZALO_THREAD_LOOKUP_SECRET,
        },
        timeout: 10000,
      });
      return response.data;
    } catch (error: any) {
      this.logger.warn(`Không tra được thread Zalo cho ${normalizedPhone}: ${error?.message ?? error}`);
      throw new BadRequestException(error?.response?.data?.error || 'Không tra được thread Zalo');
    }
  }

  async quickRoomSearch(query: QueryQuickRoomSearchDto) {
    const { roomTypeId, checkInDate, checkOutDate, buildingId } = query;

    if (!roomTypeId && !checkInDate && !checkOutDate) {
      throw new BadRequestException('Cần truyền roomTypeId hoặc checkInDate/checkOutDate');
    }

    if ((checkInDate && !checkOutDate) || (!checkInDate && checkOutDate)) {
      throw new BadRequestException('Nếu tìm theo thời gian thì cần truyền đủ checkInDate và checkOutDate');
    }

    let normalizedCheckIn: Date | undefined;
    let normalizedCheckOut: Date | undefined;

    if (checkInDate && checkOutDate) {
      normalizedCheckIn = normalizeHotelCheckIn(checkInDate);
      normalizedCheckOut = normalizeHotelCheckOut(checkOutDate);

      if (normalizedCheckOut.getTime() <= normalizedCheckIn.getTime()) {
        throw new BadRequestException('checkOutDate phải sau checkInDate');
      }
    }

    const where: any = {
      deletedAt: null,
      isActive: true,
      status: { not: RoomStatus.MAINTENANCE },
    };

    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (buildingId) where.buildingId = buildingId;

    if (normalizedCheckIn && normalizedCheckOut) {
      where.holds = { none: { ...activeHoldWhere(), checkInDate: { lt: normalizedCheckOut }, checkOutDate: { gt: normalizedCheckIn } } };
      where.reservations = {
        none: {
          deletedAt: null,
          // Search availability follows scheduled booking dates, so every
          // non-cancelled booking reserves its room for the whole stay.
          status: { not: ReservationStatus.CANCELLED },
          AND: [
            { checkInDate: { lt: normalizedCheckOut } },
            { checkOutDate: { gt: normalizedCheckIn } },
          ],
        },
      };
    }

    const rooms = await this.prisma.room.findMany({
      where,
      select: {
        id: true,
        number: true,
        floor: true,
        description: true,
        price: true,
        discountablePrice: true,
        buildingId: true,
        roomTypeId: true,
        images: { select: { url: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] },
        building: { select: { id: true, code: true, name: true } },
        roomType: { select: { id: true, name: true } },
      },
    });

    const buildingOrder = (building: { code?: string | null; name?: string | null } | null) => {
      const label = `${building?.code ?? ''} ${building?.name ?? ''}`.toUpperCase();
      if (label.includes('OPERA')) return 0;
      if (label.includes('GALLERIA')) return 1;
      if (label.includes('CREST')) return 2;
      return 3;
    };

    return rooms.map((room) => ({
      roomId: room.id,
      roomCode: room.number,
      roomNumber: room.number,
      floor: room.floor,
      description: room.description ?? String(),
      price: room.price,
      discountablePrice: room.discountablePrice,
      building: room.building,
      roomType: room.roomType,
      images: room.images.map((image) => image.url),
    })).sort((a, b) => (
      buildingOrder(a.building) - buildingOrder(b.building)
      || Number(a.floor ?? 0) - Number(b.floor ?? 0)
      || a.roomNumber.localeCompare(b.roomNumber, 'vi', { numeric: true })
    ));
  }

  async publicRoomAvailability(checkInDate: string, checkOutDate: string) {
    const validCalendarDate = (value: string) => {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const [year, month, day] = value.split('-').map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day;
    };

    if (!validCalendarDate(checkInDate) || !validCalendarDate(checkOutDate)) {
      throw new BadRequestException('Ngày nhận và trả phòng phải theo định dạng YYYY-MM-DD');
    }

    const checkIn = normalizeHotelCheckIn(checkInDate);
    const checkOut = normalizeHotelCheckOut(checkOutDate);
    const nights = Math.round((Date.parse(`${checkOutDate}T00:00:00Z`) - Date.parse(`${checkInDate}T00:00:00Z`)) / 86_400_000);
    if (checkInDate < formatHotelDate(new Date())) {
      throw new BadRequestException('Ngày nhận phòng không được ở trong quá khứ');
    }
    if (nights < 1 || nights > 365) {
      throw new BadRequestException('Vui lòng chọn thời gian lưu trú từ 1 đến 365 đêm');
    }

    const rooms = await this.prisma.room.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        status: { not: RoomStatus.MAINTENANCE },
        holds: { none: { ...activeHoldWhere(), checkInDate: { lt: checkOut }, checkOutDate: { gt: checkIn } } },
        reservations: {
          none: {
            deletedAt: null,
            status: { not: ReservationStatus.CANCELLED },
            checkInDate: { lt: checkOut },
            checkOutDate: { gt: checkIn },
          },
        },
      },
      select: {
        number: true,
        floor: true,
        building: { select: { code: true, name: true } },
        roomType: { select: { name: true } },
      },
    });

    const buildingRank = (code: string) => {
      const normalized = code.toUpperCase();
      if (normalized.includes('OPERA')) return 0;
      if (normalized.includes('GALLERIA')) return 1;
      if (normalized.includes('CREST')) return 2;
      return 3;
    };

    const availableRooms = rooms.map((room) => ({
      roomCode: room.number,
      floor: room.floor,
      building: room.building.name,
      buildingCode: room.building.code,
      roomType: room.roomType.name,
    })).sort((a, b) =>
      buildingRank(a.buildingCode) - buildingRank(b.buildingCode)
      || (a.floor ?? 0) - (b.floor ?? 0)
      || a.roomCode.localeCompare(b.roomCode, 'vi', { numeric: true })
    );

    return { checkInDate, checkOutDate, nights, total: availableRooms.length, rooms: availableRooms };
  }

  /**
   * Returns rooms that can accept a check-in on the selected day and the first
   * following booking, so reception can see each continuous vacant window.
   */
  async getVacantRoomsFromDate(dateInput?: string, buildingId?: string) {
    const start = normalizeHotelCheckIn(dateInput || formatHotelDate(new Date()));
    if (Number.isNaN(start.getTime())) throw new BadRequestException('Ngày cần xem không hợp lệ');

    const rooms = await this.prisma.room.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        ...(buildingId ? { buildingId } : {}),
        // A maintenance unit is not a sellable vacant unit for this quick list.
        status: { not: RoomStatus.MAINTENANCE },
      },
      select: {
        id: true,
        number: true,
        floor: true,
        status: true,
        building: { select: { code: true, name: true } },
        roomType: { select: { name: true } },
        reservations: {
          where: {
            deletedAt: null,
            // The quick list follows the booked timeline, not a live room
            // status. Any non-cancelled reservation blocks its scheduled stay.
            status: { not: ReservationStatus.CANCELLED },
            checkOutDate: { gt: start },
          },
          select: { checkInDate: true, checkOutDate: true },
          orderBy: { checkInDate: 'asc' },
        },
      },
      orderBy: [{ building: { code: 'asc' } }, { number: 'asc' }],
    });

    const buildingOrder = (building: { code?: string | null; name?: string | null } | null) => {
      const label = `${building?.code ?? ''} ${building?.name ?? ''}`.toUpperCase();
      if (label.includes('OPERA')) return 0;
      if (label.includes('GALLERIA')) return 1;
      if (label.includes('CREST')) return 2;
      return 3;
    };
    const roomsWithVacancy = rooms.flatMap((room) => {
      // An active stay whose dates overlap the requested check-in makes this
      // room unavailable on that day. A checkout before 14:00 is free today.
      const occupiedAtStart = room.reservations.some((reservation) => (
        reservation.checkInDate < start && reservation.checkOutDate > start
      ));
      if (occupiedAtStart) return [];

      const nextBooking = room.reservations.find((reservation) => reservation.checkInDate >= start);
      // A check-in on the selected date means the apartment has no sellable
      // vacant night from that date, even when its check-in time is later.
      if (nextBooking && formatHotelDate(nextBooking.checkInDate) === formatHotelDate(start)) return [];
      const freeUntil = nextBooking?.checkInDate ?? null;
      const freeNights = freeUntil
        ? Math.max(0, Math.ceil((freeUntil.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      return [{
        roomId: room.id,
        roomNumber: room.number,
        floor: room.floor,
        building: room.building,
        roomType: room.roomType,
        vacantFrom: formatHotelDate(start),
        vacantUntil: freeUntil ? formatHotelDate(freeUntil) : null,
        freeNights,
      }];
    }).sort((a, b) => (
      buildingOrder(a.building) - buildingOrder(b.building)
      || Number(a.floor ?? 0) - Number(b.floor ?? 0)
      || a.roomNumber.localeCompare(b.roomNumber, 'vi', { numeric: true })
    ));

    return {
      date: formatHotelDate(start),
      total: roomsWithVacancy.length,
      rooms: roomsWithVacancy,
    };
  }

  // ── Find All ────────────────────────────────────────────────────────────────
  async findAll(query: QueryReservationDto) {
    const {
      page = 1,
      limit = 20,
      q,
      status,
      roomId,
      threadId,
      checkInFrom,
      checkInTo,
      date,
    } = query;
    const where: any = {};
    const andConditions: any[] = [];

    if (q) {
      where.OR = [
        { primaryGuestName: { contains: q, mode: 'insensitive' } },
        { reservationCode: { contains: q, mode: 'insensitive' } },
        { company: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (status) where.status = status;
    if (roomId) where.roomId = roomId;
    if (threadId) where.threadId = threadId;
    if (checkInFrom || checkInTo) {
      where.checkInDate = {};
      if (checkInFrom) where.checkInDate.gte = new Date(checkInFrom);
      if (checkInTo) where.checkInDate.lte = new Date(checkInTo);
    }

    if (date) {
      const dayCheckInStart = normalizeHotelCheckIn(date);
      const dayCheckInEnd = addDays(dayCheckInStart, 1);
      const dayCheckOutEnd = normalizeHotelCheckOut(date);
      const dayCheckOutStart = addDays(dayCheckOutEnd, -1);

      andConditions.push({
        OR: [
          {
            checkInDate: {
              gte: dayCheckInStart,
              lt: dayCheckInEnd,
            },
          },
          {
            checkOutDate: {
              gt: dayCheckOutStart,
              lte: dayCheckOutEnd,
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = [...(where.AND ?? []), ...andConditions];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where,
        include: RES_INCLUDE,
        orderBy: [
          { updatedAt: 'desc' },
          { createdAt: 'desc' },
          { checkInDate: 'desc' },
        ],
        ...paginate(page, limit),
      }),
      this.prisma.reservation.count({ where }),
    ]);
    return paginatedResponse(items.map((item) => this.withFormattedDates(item)), total, page, limit);
  }

  // ── Find One ────────────────────────────────────────────────────────────────
  async findOne(id: string) {
    const res = await this.prisma.reservation.findUnique({
      where: { id },
      include: { ...RES_INCLUDE, logs: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!res) throw new NotFoundException(`Đặt phòng #${id} không tồn tại`);
    return this.withFormattedDates(res);
  }

  // ── Create ──────────────────────────────────────────────────────────────────
  async create(dto: CreateReservationDto, userId?: string) {
    const actorUserId = normalizeActorUserId(userId);
    const normalizedCheckIn = normalizeHotelCheckIn(dto.checkInDate);
    const normalizedCheckOut = normalizeHotelCheckOut(dto.checkOutDate);
    const totalNights = calcNights(dto.checkInDate, dto.checkOutDate);

    const discount = dto.discountAmount ?? 0;
    const totalAmount = dto.pricePerNight * totalNights - discount;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const initialStatus = normalizedCheckIn <= today
      ? ReservationStatus.PENDING_CHECKIN
      : ReservationStatus.BOOKED;

    const reservation = await this.inventory.transaction(async (tx) => {
      await this.inventory.rooms(tx, [dto.roomId]);
      await this.inventory.assertAvailable(tx, dto.roomId, normalizedCheckIn, normalizedCheckOut);
      const created = await tx.reservation.create({
        data: {
          reservationCode: generateCode(),
          roomId: dto.roomId,
          primaryGuestName: dto.primaryGuestName,
          company: dto.company,
          checkInDate: normalizedCheckIn,
          checkOutDate: normalizedCheckOut,
          adults: dto.adults ?? 1,
          children: dto.children ?? 0,
          ratePlanName: dto.ratePlanName,
          pricePerNight: dto.pricePerNight,
          totalNights,
          totalAmount,
          discountAmount: discount,
          depositAmount: dto.depositAmount ?? 0,
          source: dto.source,
          threadId: dto.source === 'zalo' ? (dto.threadId?.trim() || null) : null,
          notes: dto.notes,
          internalNotes: dto.internalNotes,
          createdBy: actorUserId,
          status: initialStatus,
          guests: dto.guestIds?.length
            ? { create: dto.guestIds.map((gId, i) => ({ guestId: gId, isPrimary: i === 0 })) }
            : undefined,
          logs: { create: { action: 'CREATED', userId: actorUserId, newValue: { status: initialStatus } as any } },
        },
        include: RES_INCLUDE,
      });

      await tx.room.update({
        where: { id: dto.roomId },
        data: { status: RoomStatus.RESERVED },
      });

      return created;
    });

    const formattedReservation = this.withFormattedDates(reservation);
    this.eventEmitter.emit('reservation.created', formattedReservation);
    void this.sendBookingWebhook('reservation.created', formattedReservation);
    return formattedReservation;

  }

  async announceCreated(id: string) {
    const reservation = await this.findOne(id);
    this.eventEmitter.emit('reservation.created', reservation);
    void this.sendBookingWebhook('reservation.created', reservation);
  }

  // ── Update ──────────────────────────────────────────────────────────────────
  async update(id: string, dto: UpdateReservationDto, userId?: string) {
    const actorUserId = normalizeActorUserId(userId);
    let existing: any;
    const updated = await this.inventory.reservation(id, dto.roomId, async (tx) => {
      existing = await tx.reservation.findUnique({ where: { id }, include: RES_INCLUDE });

    // Status transition side effects
    const data: any = { ...dto };
    const targetRoomId = dto.roomId ?? existing.roomId;
    const targetCheckIn = dto.checkInDate ? normalizeHotelCheckIn(dto.checkInDate) : existing.checkInDate;
    const targetCheckOut = dto.checkOutDate ? normalizeHotelCheckOut(dto.checkOutDate) : existing.checkOutDate;
    const targetStatus = dto.status ?? existing.status;
    const changesInventory = dto.roomId !== undefined || dto.checkInDate !== undefined || dto.checkOutDate !== undefined || (dto.status !== undefined && dto.status !== existing.status && ![ReservationStatus.CANCELLED, ReservationStatus.CHECKED_OUT].includes(dto.status as any));
    if (changesInventory && targetStatus !== ReservationStatus.CANCELLED) {
      await this.inventory.assertAvailable(tx, targetRoomId, targetCheckIn, targetCheckOut, id);
    }
    if (dto.status === ReservationStatus.IN_HOUSE && !existing.actualCheckIn) {
      data.actualCheckIn = dto.actualCheckIn ? new Date(dto.actualCheckIn) : new Date();
      await tx.room.update({
        where: { id: existing.roomId },
        data: { status: RoomStatus.OCCUPIED },
      });
    }
    if (dto.status === ReservationStatus.CHECKED_OUT && !existing.actualCheckOut) {
      data.actualCheckOut = dto.actualCheckOut ? new Date(dto.actualCheckOut) : new Date();
      await tx.room.update({
        where: { id: existing.roomId },
        data: { status: RoomStatus.DIRTY },
      });
    }
    if (dto.status === ReservationStatus.CANCELLED) {
      await tx.room.update({
        where: { id: existing.roomId },
        data: { status: RoomStatus.VACANT },
      });
    }

    // Recalculate if dates or price changed
    if (dto.checkInDate || dto.checkOutDate || dto.pricePerNight !== undefined) {
      const checkIn = dto.checkInDate ? normalizeHotelCheckIn(dto.checkInDate) : existing.checkInDate;
      const checkOut = dto.checkOutDate ? normalizeHotelCheckOut(dto.checkOutDate) : existing.checkOutDate;
      const price = dto.pricePerNight ?? Number(existing.pricePerNight);
      const discount = dto.discountAmount ?? Number(existing.discountAmount);

      data.checkInDate = checkIn;
      data.checkOutDate = checkOut;
      data.totalNights = calcNights(checkIn.toISOString(), checkOut.toISOString());
      data.totalAmount = price * data.totalNights - discount;
    }

    return tx.reservation.update({
      where: { id },
      data: {
        ...data,
        logs: {
          create: {
            action: dto.status ? `STATUS_CHANGED_TO_${dto.status}` : 'UPDATED',
            userId: actorUserId,
            oldValue: { status: existing.status },
            newValue: { status: dto.status },
          },
        },
      },
      include: RES_INCLUDE,
    });

    });

    const formattedUpdated = this.withFormattedDates(updated);
    if (dto.status === ReservationStatus.CANCELLED && existing.status !== ReservationStatus.CANCELLED) {
      this.eventEmitter.emit('reservation.cancelled', updated);
      void this.sendBookingWebhook('reservation.cancelled', formattedUpdated);
    } else if (dto.status === ReservationStatus.IN_HOUSE && existing.status !== ReservationStatus.IN_HOUSE) {
      this.eventEmitter.emit('reservation.checked_in', updated);
      void this.sendBookingWebhook('reservation.checked_in', formattedUpdated);
    } else if (dto.status === ReservationStatus.CHECKED_OUT && existing.status !== ReservationStatus.CHECKED_OUT) {
      this.eventEmitter.emit('reservation.checked_out', updated);
      void this.sendBookingWebhook('reservation.checked_out', formattedUpdated);
    } else if (dto.roomId && dto.roomId !== existing.roomId) {
      this.eventEmitter.emit('reservation.room_changed', updated);
      void this.sendBookingWebhook('reservation.room_changed', formattedUpdated);
    } else {
      this.eventEmitter.emit('reservation.updated', updated);
      void this.sendBookingWebhook('reservation.updated', formattedUpdated);
    }

    return formattedUpdated;

  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, RoomStatus } from '@prisma/client';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

const VN_TZ_OFFSET_HOURS = 7;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const NON_CANCELLED_STATUSES: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.PENDING_CHECKIN,
  ReservationStatus.IN_HOUSE,
  ReservationStatus.CHECKED_OUT,
];
const ACTIVE_BOOKING_STATUSES: ReservationStatus[] = [
  ReservationStatus.BOOKED,
  ReservationStatus.PENDING_CHECKIN,
  ReservationStatus.IN_HOUSE,
];
const REPORT_SOURCE_WHITELIST = new Set(['airbnb', 'trip', 'agoda', 'booking', 'zalo', 'sale', 'khac']);
const ARRIVAL_PLATFORM_LABELS = [
  { source: 'airbnb', label: 'Airbnb' },
  { source: 'trip', label: 'Trip.com' },
  { source: 'agoda', label: 'Agoda' },
  { source: 'booking', label: 'Booking.com' },
  { source: 'zalo', label: 'Zalo' },
  { source: 'sale', label: 'Sale' },
  { source: 'khac', label: 'Khác' },
] as const;

type ReservationAnalyticsItem = {
  id: string;
  reservationCode: string;
  primaryGuestName: string;
  checkInDate: Date;
  checkOutDate: Date;
  createdAt: Date;
  totalAmount: any;
  monthlyRate?: any;
  pricePerNight: any;
  totalNights: number;
  status: ReservationStatus;
  source: string | null;
  room: {
    id: string;
    number: string;
    building: { code: string; name: string } | null;
    roomType?: { name: string } | null;
  } | null;
  guests?: { guest: { nationality: string | null } }[];
};

function vnDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return new Date(Date.UTC(year, month - 1, day, hour - VN_TZ_OFFSET_HOURS, minute, second, 0));
}

function getVnParts(date = new Date()) {
  const vn = new Date(date.getTime() + VN_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  return {
    year: vn.getUTCFullYear(),
    month: vn.getUTCMonth() + 1,
    day: vn.getUTCDate(),
  };
}

function getDayRangeVn(date = new Date()) {
  const { year, month, day } = getVnParts(date);
  const start = vnDate(year, month, day, 0, 0, 0);
  const end = new Date(start.getTime() + MS_PER_DAY);
  return { start, end };
}

function getMonthRangeVn(year: number, month: number) {
  const start = vnDate(year, month, 1, 0, 0, 0);
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const end = vnDate(nextMonthYear, nextMonth, 1, 0, 0, 0);
  return { start, end };
}

function getQuarterRangeVn(year: number, quarter: number) {
  const firstMonth = (quarter - 1) * 3 + 1;
  const start = vnDate(year, firstMonth, 1, 0, 0, 0);
  const endMonth = firstMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  const normalizedEndMonth = endMonth > 12 ? endMonth - 12 : endMonth;
  const end = vnDate(endYear, normalizedEndMonth, 1, 0, 0, 0);
  return { start, end };
}

function getYearRangeVn(year: number) {
  return { start: vnDate(year, 1, 1, 0, 0, 0), end: vnDate(year + 1, 1, 1, 0, 0, 0) };
}

function formatMonthLabel(date: Date) {
  const parts = getVnParts(date);
  return `${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

function formatCurrency(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function toNumber(value: any) {
  return Number(value ?? 0);
}

function pctChange(current: number, previous: number) {
  if (!previous) return current ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function nightsBetween(start: Date, end: Date) {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / MS_PER_DAY));
}

function startOfVnDay(date: Date) {
  const parts = getVnParts(date);
  return vnDate(parts.year, parts.month, parts.day, 0, 0, 0);
}

function overlapNights(rangeStart: Date, rangeEnd: Date, checkIn: Date, checkOut: Date) {
  const normalizedCheckIn = startOfVnDay(checkIn).getTime();
  const normalizedCheckOut = startOfVnDay(checkOut).getTime();
  const start = Math.max(rangeStart.getTime(), normalizedCheckIn);
  const end = Math.min(rangeEnd.getTime(), normalizedCheckOut);
  if (end <= start) return 0;
  return Math.round((end - start) / MS_PER_DAY);
}

type RevenueStay = { totalAmount: any; monthlyRate?: any; totalNights?: number | null; checkInDate: Date; checkOutDate: Date };

function stayNights(stay: RevenueStay) {
  const storedNights = Number(stay.totalNights ?? 0);
  return Number.isFinite(storedNights) && storedNights > 0
    ? storedNights
    : nightsBetween(stay.checkInDate, stay.checkOutDate);
}

// Revenue is recognised per stayed night, rather than all at once on check-in.
// Long-term leases may instead have a fixed price for every calendar month.
// In that case a complete calendar month always recognises exactly monthlyRate;
// partial months are pro-rated by that month's number of nights.
function recognisedRevenue(stay: RevenueStay, rangeStart: Date, rangeEnd: Date) {
  const monthlyRate = toNumber(stay.monthlyRate);
  if (monthlyRate > 0) {
    let revenue = 0;
    forEachRecognisedNight(stay, rangeStart, rangeEnd, (_dateKey, nightlyRevenue) => {
      revenue += nightlyRevenue;
    });
    return revenue;
  }
  return (toNumber(stay.totalAmount) / stayNights(stay))
    * overlapNights(rangeStart, rangeEnd, stay.checkInDate, stay.checkOutDate);
}

function sumRecognisedRevenue(items: RevenueStay[], rangeStart: Date, rangeEnd: Date) {
  return items.reduce((sum, item) => sum + recognisedRevenue(item, rangeStart, rangeEnd), 0);
}

function vnDateKey(date: Date) {
  const parts = getVnParts(date);
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function forEachRecognisedNight(stay: RevenueStay, rangeStart: Date, rangeEnd: Date, callback: (dateKey: string, revenue: number) => void) {
  const start = Math.max(startOfVnDay(stay.checkInDate).getTime(), rangeStart.getTime());
  const end = Math.min(startOfVnDay(stay.checkOutDate).getTime(), rangeEnd.getTime());
  for (let cursor = new Date(start); cursor.getTime() < end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const monthlyRate = toNumber(stay.monthlyRate);
    const vn = getVnParts(cursor);
    const nightsInMonth = new Date(Date.UTC(vn.year, vn.month, 0)).getUTCDate();
    const nightlyRevenue = monthlyRate > 0
      ? monthlyRate / nightsInMonth
      : toNumber(stay.totalAmount) / stayNights(stay);
    callback(vnDateKey(cursor), nightlyRevenue);
  }
}

function parseReportDateParts(input?: string) {
  if (!input) return null;
  const value = input.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return null;
  return { year, month, day };
}

function normalizeSource(source?: string | null) {
  return String(source ?? '').trim().toLowerCase();
}

function isReportableSource(source?: string | null) {
  return REPORT_SOURCE_WHITELIST.has(normalizeSource(source));
}

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  async getSummary() {
    const todayRange = getDayRangeVn();
    const vnToday = getVnParts();
    const currentQuarter = Math.floor((vnToday.month - 1) / 3) + 1;
    const previousQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
    const previousQuarterYear = currentQuarter === 1 ? vnToday.year - 1 : vnToday.year;

    const currentMonthRange = getMonthRangeVn(vnToday.year, vnToday.month);
    const previousMonthRange = vnToday.month === 1
      ? getMonthRangeVn(vnToday.year - 1, 12)
      : getMonthRangeVn(vnToday.year, vnToday.month - 1);
    const currentQuarterRange = getQuarterRangeVn(vnToday.year, currentQuarter);
    const previousQuarterRange = getQuarterRangeVn(previousQuarterYear, previousQuarter);
    const currentYearRange = getYearRangeVn(vnToday.year);
    const previousYearRange = getYearRangeVn(vnToday.year - 1);

    const trendStart = getMonthRangeVn(vnToday.month <= 11 ? vnToday.year - 1 : vnToday.year, ((vnToday.month + 1) % 12) || 12).start;

    const [rooms, reservations, guestsMeta, totalGuests, recentReservations] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, number: true, status: true, building: { select: { id: true, code: true, name: true } } },
      }),
      this.prisma.reservation.findMany({
        where: {
          deletedAt: null,
          status: { in: NON_CANCELLED_STATUSES },
          room: { is: { status: { not: RoomStatus.MAINTENANCE } } },
          OR: [
            { checkOutDate: { gte: trendStart } },
            { createdAt: { gte: trendStart } },
          ],
        },
        select: {
          id: true,
          reservationCode: true,
          primaryGuestName: true,
          checkInDate: true,
          checkOutDate: true,
          createdAt: true,
          totalAmount: true,
          monthlyRate: true,
          totalNights: true,
          adults: true,
          children: true,
          status: true,
          source: true,
          room: { select: { id: true, number: true, building: { select: { code: true, name: true } } } },
          guests: { select: { guest: { select: { nationality: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.guest.findMany({
        select: { nationality: true, gender: true },
      }),
      this.prisma.guest.count(),
      this.prisma.reservation.findMany({
        take: 8,
        where: { deletedAt: null, room: { is: { status: { not: RoomStatus.MAINTENANCE } } } },
        orderBy: { createdAt: 'desc' },
        include: { room: { select: { number: true, building: { select: { code: true, name: true } } } } },
      }),
    ]);

    const activeRooms = rooms.length;
    const maintenanceRoomIds = new Set(rooms.filter((room) => room.status === RoomStatus.MAINTENANCE).map((room) => room.id));
    const occupiedRoomIds = new Set<string>();
    const reservedRoomIds = new Set<string>();
    const now = new Date();

    // Room.status is an operational/manual state and can be stale after an
    // Excel import. The dashboard snapshot must instead reflect the bookings
    // that are actually active at this moment.
    reservations.forEach((reservation) => {
      if (!reservation.room || !ACTIVE_BOOKING_STATUSES.includes(reservation.status)) return;
      const roomId = reservation.room.id;
      if (maintenanceRoomIds.has(roomId)) return;
      if (reservation.checkInDate <= now && reservation.checkOutDate > now) {
        occupiedRoomIds.add(roomId);
        reservedRoomIds.delete(roomId);
      } else if (reservation.checkInDate > now && !occupiedRoomIds.has(roomId)) {
        reservedRoomIds.add(roomId);
      }
    });

    const occupiedRooms = occupiedRoomIds.size;
    const reservedRooms = Array.from(reservedRoomIds).filter((roomId) => !occupiedRoomIds.has(roomId)).length;
    const maintenanceRooms = maintenanceRoomIds.size;
    const reportableRooms = Math.max(0, activeRooms - maintenanceRooms);
    const availableRooms = Math.max(0, reportableRooms - occupiedRooms - reservedRooms);
    const sourceReportReservations = reservations.filter((reservation) => isReportableSource(reservation.source));

    const todayArrivals = reservations.filter((reservation) => reservation.checkInDate >= todayRange.start && reservation.checkInDate < todayRange.end);
    const todayCheckouts = reservations.filter((reservation) => reservation.checkOutDate >= todayRange.start && reservation.checkOutDate < todayRange.end);
    const arrivalsToday = todayArrivals.length;
    const checkoutsToday = todayCheckouts.length;
    const arrivalRoomsToday = new Set(todayArrivals.map((reservation) => reservation.room?.id).filter(Boolean)).size;
    const checkoutRoomsToday = new Set(todayCheckouts.map((reservation) => reservation.room?.id).filter(Boolean)).size;
    const dailyMovementByRoom = new Map<string, {
      roomId: string;
      roomNumber: string;
      buildingName: string;
      buildingCode: string;
      checkInGuests: string[];
      checkOutGuests: string[];
    }>();
    const addDailyMovement = (reservation: typeof reservations[number], type: 'checkInGuests' | 'checkOutGuests') => {
      if (!reservation.room?.id) return;
      const row = dailyMovementByRoom.get(reservation.room.id) ?? {
        roomId: reservation.room.id,
        roomNumber: reservation.room.number,
        buildingName: reservation.room.building?.name ?? '',
        buildingCode: reservation.room.building?.code ?? '',
        checkInGuests: [],
        checkOutGuests: [],
      };
      if (!row[type].includes(reservation.primaryGuestName)) row[type].push(reservation.primaryGuestName);
      dailyMovementByRoom.set(reservation.room.id, row);
    };
    todayArrivals.forEach((reservation) => addDailyMovement(reservation, 'checkInGuests'));
    todayCheckouts.forEach((reservation) => addDailyMovement(reservation, 'checkOutGuests'));
    const buildingOrder = (movement: { buildingName: string; buildingCode: string }) => {
      const building = `${movement.buildingName} ${movement.buildingCode}`.toLowerCase();
      if (building.includes('opera')) return 0;
      if (building.includes('galleria')) return 1;
      if (building.includes('crest')) return 2;
      return 3;
    };
    const dailyRoomMovements = Array.from(dailyMovementByRoom.values())
      .sort((a, b) => buildingOrder(a) - buildingOrder(b)
        || a.buildingName.localeCompare(b.buildingName, 'vi')
        || a.roomNumber.localeCompare(b.roomNumber, 'vi', { numeric: true }));
    const arrivalGuestsToday = todayArrivals.reduce((sum, reservation) => sum + Number(reservation.adults ?? 0) + Number(reservation.children ?? 0), 0);
    const checkoutGuestsToday = todayCheckouts.reduce((sum, reservation) => sum + Number(reservation.adults ?? 0) + Number(reservation.children ?? 0), 0);
    const arrivalsTodayBySource = ARRIVAL_PLATFORM_LABELS.map(({ source, label }) => {
      const bookings = todayArrivals.filter((reservation) => normalizeSource(reservation.source) === source && ['BOOKED', 'PENDING_CHECKIN'].includes(reservation.status)).length;
      return { source, label, bookings };
    });
    const inHouseReservations = reservations.filter((reservation) => reservation.status === ReservationStatus.IN_HOUSE);
    const futureActiveReservations = reservations.filter(
      (reservation) => reservation.status !== ReservationStatus.IN_HOUSE && reservation.checkInDate >= todayRange.start,
    );

    const revenueCurrentMonth = sumRecognisedRevenue(reservations, currentMonthRange.start, currentMonthRange.end);
    const revenuePreviousMonth = sumRecognisedRevenue(reservations, previousMonthRange.start, previousMonthRange.end);
    const revenueCurrentQuarter = sumRecognisedRevenue(reservations, currentQuarterRange.start, currentQuarterRange.end);
    const revenuePreviousQuarter = sumRecognisedRevenue(reservations, previousQuarterRange.start, previousQuarterRange.end);
    const revenueCurrentYear = sumRecognisedRevenue(reservations, currentYearRange.start, currentYearRange.end);
    const revenuePreviousYear = sumRecognisedRevenue(reservations, previousYearRange.start, previousYearRange.end);

    const monthlyRevenueTrend = Array.from({ length: 12 }, (_, index) => {
      const monthDate = vnDate(vnToday.year, vnToday.month, 1, 0, 0, 0);
      monthDate.setUTCMonth(monthDate.getUTCMonth() - (11 - index));
      const parts = getVnParts(monthDate);
      const range = getMonthRangeVn(parts.year, parts.month);
      return {
        label: formatMonthLabel(range.start),
        revenue: formatCurrency(sumRecognisedRevenue(reservations, range.start, range.end)),
        bookings: reservations.filter((reservation) => reservation.checkInDate < range.end && reservation.checkOutDate > range.start).length,
      };
    });

    const sourceCounts = new Map<string, number>();
    sourceReportReservations.forEach((reservation) => {
      const source = reservation.source?.trim() || 'Chưa rõ';
      sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    });
    const totalSourceCount = Array.from(sourceCounts.values()).reduce((sum, value) => sum + value, 0);
    const sourceBreakdown = Array.from(sourceCounts.entries())
      .map(([source, count]) => ({
        source,
        count,
        percentage: totalSourceCount ? Number(((count / totalSourceCount) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const nationalityCounts = new Map<string, number>();
    guestsMeta.forEach((guest) => {
      const nationality = guest.nationality?.trim();
      if (!nationality) return;
      nationalityCounts.set(nationality, (nationalityCounts.get(nationality) ?? 0) + 1);
    });
    const nationalityBreakdown = Array.from(nationalityCounts.entries())
      .map(([nationality, count]) => ({ nationality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const genderLabelMap: Record<string, string> = {
      MALE: 'Nam',
      FEMALE: 'Nữ',
      NON_BINARY: 'Khác',
    };
    const genderCounts = new Map<string, number>();
    guestsMeta.forEach((guest) => {
      if (!guest.gender) return;
      genderCounts.set(guest.gender, (genderCounts.get(guest.gender) ?? 0) + 1);
    });
    const totalGenderProfiles = Array.from(genderCounts.values()).reduce((sum, value) => sum + value, 0);
    const genderBreakdown = Array.from(genderCounts.entries())
      .map(([gender, count]) => ({
        gender,
        label: genderLabelMap[gender] ?? gender,
        count,
        percentage: totalGenderProfiles ? Number(((count / totalGenderProfiles) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const buildingRevenueMap = new Map<string, { building: string; bookings: number; revenue: number }>();
    reservations.forEach((reservation) => {
      const buildingName = reservation.room?.building?.name || reservation.room?.building?.code || 'Chưa rõ';
      const current = buildingRevenueMap.get(buildingName) ?? { building: buildingName, bookings: 0, revenue: 0 };
      current.bookings += 1;
      current.revenue += recognisedRevenue(reservation, trendStart, currentYearRange.end);
      buildingRevenueMap.set(buildingName, current);
    });
    const buildingPerformance = Array.from(buildingRevenueMap.values()).sort((a, b) => b.revenue - a.revenue);

    const averageStayNights = reservations.length
      ? Number((reservations.reduce((sum, reservation) => sum + (reservation.totalNights ?? 0), 0) / reservations.length).toFixed(1))
      : 0;
    const averageBookingValue = reservations.length
      ? Math.round(reservations.reduce((sum, reservation) => sum + toNumber(reservation.totalAmount), 0) / reservations.length)
      : 0;

    return {
      generatedAt: new Date().toISOString(),
      rooms: {
        total: reportableRooms,
        occupied: occupiedRooms,
        available: availableRooms,
        maintenance: maintenanceRooms,
        reserved: reservedRooms,
        occupancyRate: reportableRooms ? Number(((occupiedRooms / reportableRooms) * 100).toFixed(1)) : 0,
      },
      reservations: {
        inHouse: inHouseReservations.length,
        active: reservations.filter((reservation) => ACTIVE_BOOKING_STATUSES.includes(reservation.status)).length,
        futureActive: futureActiveReservations.length,
        arrivalsToday,
        checkoutsToday,
        arrivalRoomsToday,
        checkoutRoomsToday,
        dailyRoomMovements,
        arrivalGuestsToday,
        checkoutGuestsToday,
        arrivalsTodayBySource,
      },
      guests: {
        total: totalGuests,
        nationalitiesTracked: nationalityCounts.size,
        genderProfilesTracked: totalGenderProfiles,
      },
      revenue: {
        month: { current: revenueCurrentMonth, previous: revenuePreviousMonth, pctChange: pctChange(revenueCurrentMonth, revenuePreviousMonth) },
        quarter: { current: revenueCurrentQuarter, previous: revenuePreviousQuarter, pctChange: pctChange(revenueCurrentQuarter, revenuePreviousQuarter) },
        year: { current: revenueCurrentYear, previous: revenuePreviousYear, pctChange: pctChange(revenueCurrentYear, revenuePreviousYear) },
      },
      analytics: {
        monthlyRevenueTrend,
        sourceBreakdown,
        nationalityBreakdown,
        genderBreakdown,
        buildingPerformance,
        averageStayNights,
        averageBookingValue,
      },
      recent: recentReservations,
    };
  }

  async getReport(from?: string, to?: string) {
    const parsedFrom = parseReportDateParts(from);
    const parsedTo = parseReportDateParts(to);
    if (!parsedFrom || !parsedTo) {
      throw new BadRequestException('Cần truyền from/to theo định dạng YYYY-MM-DD');
    }

    const rangeStart = vnDate(parsedFrom.year, parsedFrom.month, parsedFrom.day, 0, 0, 0);
    const rangeEnd = vnDate(parsedTo.year, parsedTo.month, parsedTo.day + 1, 0, 0, 0);
    if (rangeEnd <= rangeStart) {
      throw new BadRequestException('Khoảng ngày không hợp lệ');
    }
    const periodDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY));

    const [rooms, reservations] = await this.prisma.$transaction([
      this.prisma.room.findMany({
        where: { isActive: true, deletedAt: null, status: { not: RoomStatus.MAINTENANCE } },
        select: {
          id: true,
          number: true,
          status: true,
          floor: true,
          monthlyCost: true,
          building: { select: { id: true, code: true, name: true } },
          roomType: { select: { id: true, name: true } },
        },
      }),
      this.prisma.reservation.findMany({
        where: {
          deletedAt: null,
          status: { in: NON_CANCELLED_STATUSES },
          room: { is: { status: { not: RoomStatus.MAINTENANCE } } },
          checkInDate: { lt: rangeEnd },
          checkOutDate: { gt: rangeStart },
        },
        select: {
          id: true,
          reservationCode: true,
          primaryGuestName: true,
          checkInDate: true,
          checkOutDate: true,
          createdAt: true,
          totalAmount: true,
          monthlyRate: true,
          pricePerNight: true,
          totalNights: true,
          status: true,
          source: true,
          room: {
            select: {
              number: true,
              building: { select: { code: true, name: true } },
              roomType: { select: { name: true } },
            },
          },
        },
        orderBy: { checkInDate: 'asc' },
      }),
    ]);

    const roomMetrics = new Map<string, {
      roomId: string;
      roomNumber: string;
      building: string;
      roomType: string;
      bookings: number;
      occupiedNights: number;
      revenue: number;
      bookedNightRevenue: number;
      avgStay: number;
      occupancyRate: number;
      monthlyCost: number | null;
    }>();

    const bySource = new Map<string, { label: string; bookings: number; revenue: number }>();
    const byBuilding = new Map<string, { label: string; bookings: number; revenue: number }>();
    const byRoomType = new Map<string, { label: string; bookings: number; revenue: number }>();
    const dailyRevenueMap = new Map<string, { date: string; revenue: number; bookings: number }>();

    rooms.forEach((room) => {
      roomMetrics.set(room.id, {
        roomId: room.id,
        roomNumber: room.number,
        building: room.building?.code || room.building?.name || '—',
        roomType: room.roomType?.name || 'Chưa rõ',
        bookings: 0,
        occupiedNights: 0,
        revenue: 0,
        bookedNightRevenue: 0,
        avgStay: 0,
        occupancyRate: 0,
        monthlyCost: room.monthlyCost == null ? null : toNumber(room.monthlyCost),
      });
    });

    let totalRevenue = 0;
    let totalOccupiedNights = 0;
    let totalBookingNights = 0;
    let totalBookings = 0;

    const allReservations = reservations as ReservationAnalyticsItem[];
    const sourceReservations = allReservations.filter((reservation) => isReportableSource(reservation.source));
    const occupancyReservations = allReservations.filter(
      (reservation) => reservation.checkInDate < rangeEnd && reservation.checkOutDate > rangeStart,
    );

    occupancyReservations.forEach((reservation) => {
      const revenue = recognisedRevenue(reservation, rangeStart, rangeEnd);
      const buildingLabel = reservation.room?.building?.code || reservation.room?.building?.name || 'Chưa rõ';
      const roomTypeLabel = reservation.room?.roomType?.name || 'Chưa rõ';

      totalRevenue += revenue;
      totalBookingNights += reservation.totalNights ?? nightsBetween(reservation.checkInDate, reservation.checkOutDate);
      totalBookings += 1;

      const buildingRow = byBuilding.get(buildingLabel) ?? { label: buildingLabel, bookings: 0, revenue: 0 };
      buildingRow.bookings += 1;
      buildingRow.revenue += revenue;
      byBuilding.set(buildingLabel, buildingRow);

      const roomTypeRow = byRoomType.get(roomTypeLabel) ?? { label: roomTypeLabel, bookings: 0, revenue: 0 };
      roomTypeRow.bookings += 1;
      roomTypeRow.revenue += revenue;
      byRoomType.set(roomTypeLabel, roomTypeRow);

      forEachRecognisedNight(reservation, rangeStart, rangeEnd, (dateKey, nightlyRevenue) => {
        const dayRow = dailyRevenueMap.get(dateKey) ?? { date: dateKey, revenue: 0, bookings: 0 };
        dayRow.revenue += nightlyRevenue;
        dayRow.bookings += 1;
        dailyRevenueMap.set(dateKey, dayRow);
      });

      const room = rooms.find((item) => item.number === reservation.room?.number && item.building?.code === reservation.room?.building?.code);
      if (!room) return;
      const metric = roomMetrics.get(room.id);
      if (!metric) return;
      metric.bookings += 1;
      metric.revenue += revenue;
      metric.avgStay += reservation.totalNights ?? nightsBetween(reservation.checkInDate, reservation.checkOutDate);
    });

    sourceReservations
      .filter((reservation) => reservation.checkInDate < rangeEnd && reservation.checkOutDate > rangeStart)
      .forEach((reservation) => {
        const revenue = recognisedRevenue(reservation, rangeStart, rangeEnd);
        const sourceLabel = reservation.source?.trim() || 'Chưa rõ';
        const sourceRow = bySource.get(sourceLabel) ?? { label: sourceLabel, bookings: 0, revenue: 0 };
        sourceRow.bookings += 1;
        sourceRow.revenue += revenue;
        bySource.set(sourceLabel, sourceRow);
      });

    occupancyReservations.forEach((reservation) => {
      const occupiedNights = overlapNights(rangeStart, rangeEnd, reservation.checkInDate, reservation.checkOutDate);
      if (occupiedNights <= 0) return;

      totalOccupiedNights += occupiedNights;

      const room = rooms.find((item) => item.number === reservation.room?.number && item.building?.code === reservation.room?.building?.code);
      if (!room) return;
      const metric = roomMetrics.get(room.id);
      if (!metric) return;
      metric.occupiedNights += occupiedNights;
      // Keep room-level revenue aligned with the dashboard total: allocate
      // the booking's final total evenly across its stayed nights.
      metric.bookedNightRevenue += recognisedRevenue(reservation, rangeStart, rangeEnd);
    });

    const totalRoomNights = rooms.length * periodDays;
    const occupancyOverall = totalRoomNights ? Number(((totalOccupiedNights / totalRoomNights) * 100).toFixed(1)) : 0;

    const occupancyByRoom = Array.from(roomMetrics.values())
      .map((metric) => ({
        ...metric,
        avgStay: metric.bookings ? Number((metric.avgStay / metric.bookings).toFixed(1)) : 0,
        occupancyRate: periodDays ? Number(((metric.occupiedNights / periodDays) * 100).toFixed(1)) : 0,
        bookedNightRevenue: Math.round(metric.bookedNightRevenue),
        totalNightsInPeriod: periodDays,
      }))
      .sort((a, b) => b.occupancyRate - a.occupancyRate || b.occupiedNights - a.occupiedNights || b.revenue - a.revenue || b.bookings - a.bookings);

    const topRooms = occupancyByRoom.slice(0, 10);

    const toBreakdown = (map: Map<string, { label: string; bookings: number; revenue: number }>) =>
      Array.from(map.values())
        .sort((a, b) => b.bookings - a.bookings || b.revenue - a.revenue)
        .map((item) => ({
          ...item,
          percentage: totalBookings ? Number(((item.bookings / totalBookings) * 100).toFixed(1)) : 0,
        }));

    const sourceBreakdown = toBreakdown(bySource);
    const buildingBreakdown = toBreakdown(byBuilding);
    const roomTypeBreakdown = toBreakdown(byRoomType);
    const revenueByDay = Array.from(dailyRevenueMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    return {
      range: {
        from,
        to,
        periodDays,
      },
      revenue: {
        total: formatCurrency(totalRevenue),
        bookings: totalBookings,
        avgBookingValue: totalBookings ? Math.round(totalRevenue / totalBookings) : 0,
        avgStayNights: totalBookings ? Number((totalBookingNights / totalBookings).toFixed(1)) : 0,
        occupiedNights: Number(totalOccupiedNights.toFixed(1)),
        bySource: sourceBreakdown,
        byBuilding: buildingBreakdown,
        byRoomType: roomTypeBreakdown,
        byDay: revenueByDay,
      },
      occupancy: {
        overallRate: occupancyOverall,
        totalRoomNights,
        occupiedNights: Number(totalOccupiedNights.toFixed(1)),
        availableRooms: rooms.length,
        byRoom: occupancyByRoom,
      },
      topRooms,
      insights: {
        topSource: sourceBreakdown[0] ?? null,
        topBuilding: buildingBreakdown[0] ?? null,
        topRoomType: roomTypeBreakdown[0] ?? null,
        topRoom: topRooms[0] ?? null,
      },
    };
  }

  async getCustomerReport(from?: string, to?: string) {
    const parsedFrom = parseReportDateParts(from);
    const parsedTo = parseReportDateParts(to);
    if (!parsedFrom || !parsedTo) {
      throw new BadRequestException('Cần truyền from/to theo định dạng YYYY-MM-DD');
    }

    const rangeStart = vnDate(parsedFrom.year, parsedFrom.month, parsedFrom.day, 0, 0, 0);
    const rangeEnd = vnDate(parsedTo.year, parsedTo.month, parsedTo.day + 1, 0, 0, 0);
    if (rangeEnd <= rangeStart) {
      throw new BadRequestException('Khoảng ngày không hợp lệ');
    }

    const reservations = await this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        status: { in: NON_CANCELLED_STATUSES },
        room: { is: { status: { not: RoomStatus.MAINTENANCE } } },
        checkInDate: { gte: rangeStart, lt: rangeEnd },
      },
      select: {
        totalAmount: true,
        totalNights: true,
        checkInDate: true,
        room: { select: { number: true, building: { select: { code: true, name: true } } } },
        guests: {
          where: { isPrimary: true },
          select: { guest: { select: { id: true, fullName: true } } },
        },
      },
    });

    const customers = new Map<string, { guestId: string; fullName: string; bookings: number; totalNights: number; revenue: number; lastStay: Date; rooms: Set<string> }>();
    reservations.forEach((reservation) => {
      const primary = reservation.guests[0]?.guest;
      if (!primary) return;
      const row = customers.get(primary.id) ?? {
        guestId: primary.id,
        fullName: primary.fullName,
        bookings: 0,
        totalNights: 0,
        revenue: 0,
        lastStay: reservation.checkInDate,
        rooms: new Set<string>(),
      };
      row.bookings += 1;
      row.totalNights += reservation.totalNights || nightsBetween(reservation.checkInDate, new Date(reservation.checkInDate.getTime() + MS_PER_DAY));
      row.revenue += toNumber(reservation.totalAmount);
      if (reservation.checkInDate > row.lastStay) row.lastStay = reservation.checkInDate;
      const building = reservation.room?.building?.code || reservation.room?.building?.name || '';
      row.rooms.add([building, reservation.room?.number].filter(Boolean).join(' '));
      customers.set(primary.id, row);
    });

    const customerRows = Array.from(customers.values())
      .map((row) => ({
        guestId: row.guestId,
        fullName: row.fullName,
        bookings: row.bookings,
        totalNights: row.totalNights,
        revenue: Math.round(row.revenue),
        lastStay: row.lastStay.toISOString(),
        distinctRooms: row.rooms.size,
        familiar: row.bookings >= 2,
      }))
      .sort((a, b) => b.bookings - a.bookings || b.totalNights - a.totalNights || b.revenue - a.revenue || a.fullName.localeCompare(b.fullName));

    return {
      range: { from, to },
      totals: {
        guests: customerRows.length,
        familiarGuests: customerRows.filter((row) => row.familiar).length,
        bookings: reservations.length,
      },
      customers: customerRows,
    };
  }

  async exportDailyRoomMovements(res: Response) {
    const summary = await this.getSummary();
    const movements = summary.reservations.dailyRoomMovements ?? [];
    const today = getVnParts();
    const dateLabel = `${String(today.day).padStart(2, '0')}/${String(today.month).padStart(2, '0')}/${today.year}`;
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'ChiLuxe Hotel Manager';
    const worksheet = workbook.addWorksheet('Check-in Check-out');

    worksheet.addRow(['BÁO CÁO CĂN CHECK-IN / CHECK-OUT HÔM NAY']);
    worksheet.mergeCells('A1:D1');
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };
    worksheet.addRow([`Ngày: ${dateLabel}`]);
    worksheet.mergeCells('A2:D2');
    worksheet.addRow([`Tổng số căn Check-in: ${summary.reservations.arrivalRoomsToday ?? 0}`, `Tổng số căn Check-out: ${summary.reservations.checkoutRoomsToday ?? 0}`]);
    worksheet.mergeCells('A3:B3');
    worksheet.mergeCells('C3:D3');
    worksheet.addRow([]);

    const header = worksheet.addRow(['STT', 'Mã căn hộ', 'Khách Check-out', 'Khách Check-in']);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });
    movements.forEach((movement, index) => {
      const row = worksheet.addRow([index + 1, movement.roomNumber, movement.checkOutGuests?.join(', ') || '—', movement.checkInGuests?.join(', ') || '—']);
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'top', wrapText: true };
        cell.border = { top: { style: 'thin', color: { argb: 'FFD9E2F3' } }, left: { style: 'thin', color: { argb: 'FFD9E2F3' } }, bottom: { style: 'thin', color: { argb: 'FFD9E2F3' } }, right: { style: 'thin', color: { argb: 'FFD9E2F3' } } };
      });
    });
    worksheet.columns = [{ width: 8 }, { width: 18 }, { width: 42 }, { width: 42 }];
    worksheet.views = [{ state: 'frozen', ySplit: 5 }];

    const dateFile = `${today.year}${String(today.month).padStart(2, '0')}${String(today.day).padStart(2, '0')}`;
    res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename=checkin_checkout_${dateFile}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}

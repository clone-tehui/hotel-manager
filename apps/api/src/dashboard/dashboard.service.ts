import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ReservationStatus, RoomStatus } from '@prisma/client';

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
const REPORT_SOURCE_WHITELIST = new Set(['airbnb', 'zalo', 'sale', 'khac']);

type ReservationAnalyticsItem = {
  id: string;
  reservationCode: string;
  primaryGuestName: string;
  checkInDate: Date;
  checkOutDate: Date;
  createdAt: Date;
  totalAmount: any;
  pricePerNight: any;
  totalNights: number;
  status: ReservationStatus;
  source: string | null;
  room: {
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

function sumReservationRevenue(items: Array<{ totalAmount: any }>) {
  return items.reduce((sum, item) => sum + toNumber(item.totalAmount), 0);
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
          totalNights: true,
          status: true,
          source: true,
          room: { select: { number: true, building: { select: { code: true, name: true } } } },
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
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { room: { select: { number: true, building: { select: { code: true, name: true } } } } },
      }),
    ]);

    const activeRooms = rooms.length;
    const occupiedRooms = rooms.filter((room) => room.status === RoomStatus.OCCUPIED).length;
    const availableRooms = rooms.filter((room) => room.status === RoomStatus.VACANT).length;
    const maintenanceRooms = rooms.filter((room) => room.status === RoomStatus.MAINTENANCE).length;
    const reservedRooms = rooms.filter((room) => room.status === RoomStatus.RESERVED).length;
    const sourceReportReservations = reservations.filter((reservation) => isReportableSource(reservation.source));

    const arrivalsToday = reservations.filter((reservation) => reservation.checkInDate >= todayRange.start && reservation.checkInDate < todayRange.end).length;
    const checkoutsToday = reservations.filter((reservation) => reservation.checkOutDate >= todayRange.start && reservation.checkOutDate < todayRange.end).length;
    const inHouseReservations = reservations.filter((reservation) => reservation.status === ReservationStatus.IN_HOUSE);
    const futureActiveReservations = reservations.filter(
      (reservation) => reservation.status !== ReservationStatus.IN_HOUSE && reservation.checkInDate >= todayRange.start,
    );

    const revenueCurrentMonth = sumReservationRevenue(reservations.filter((reservation) => reservation.checkInDate >= currentMonthRange.start && reservation.checkInDate < currentMonthRange.end));
    const revenuePreviousMonth = sumReservationRevenue(reservations.filter((reservation) => reservation.checkInDate >= previousMonthRange.start && reservation.checkInDate < previousMonthRange.end));
    const revenueCurrentQuarter = sumReservationRevenue(reservations.filter((reservation) => reservation.checkInDate >= currentQuarterRange.start && reservation.checkInDate < currentQuarterRange.end));
    const revenuePreviousQuarter = sumReservationRevenue(reservations.filter((reservation) => reservation.checkInDate >= previousQuarterRange.start && reservation.checkInDate < previousQuarterRange.end));
    const revenueCurrentYear = sumReservationRevenue(reservations.filter((reservation) => reservation.checkInDate >= currentYearRange.start && reservation.checkInDate < currentYearRange.end));
    const revenuePreviousYear = sumReservationRevenue(reservations.filter((reservation) => reservation.checkInDate >= previousYearRange.start && reservation.checkInDate < previousYearRange.end));

    const monthlyRevenueTrend = Array.from({ length: 12 }, (_, index) => {
      const monthDate = vnDate(vnToday.year, vnToday.month, 1, 0, 0, 0);
      monthDate.setUTCMonth(monthDate.getUTCMonth() - (11 - index));
      const parts = getVnParts(monthDate);
      const range = getMonthRangeVn(parts.year, parts.month);
      const monthReservations = reservations.filter((reservation) => reservation.checkInDate >= range.start && reservation.checkInDate < range.end);
      return {
        label: formatMonthLabel(range.start),
        revenue: formatCurrency(sumReservationRevenue(monthReservations)),
        bookings: monthReservations.length,
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
      current.revenue += toNumber(reservation.totalAmount);
      buildingRevenueMap.set(buildingName, current);
    });
    const buildingPerformance = Array.from(buildingRevenueMap.values()).sort((a, b) => b.revenue - a.revenue);

    const averageStayNights = reservations.length
      ? Number((reservations.reduce((sum, reservation) => sum + (reservation.totalNights ?? 0), 0) / reservations.length).toFixed(1))
      : 0;
    const averageBookingValue = reservations.length
      ? Math.round(sumReservationRevenue(reservations) / reservations.length)
      : 0;

    return {
      generatedAt: new Date().toISOString(),
      rooms: {
        total: activeRooms,
        occupied: occupiedRooms,
        available: availableRooms,
        maintenance: maintenanceRooms,
        reserved: reservedRooms,
        occupancyRate: activeRooms ? Number(((occupiedRooms / activeRooms) * 100).toFixed(1)) : 0,
      },
      reservations: {
        inHouse: inHouseReservations.length,
        active: reservations.filter((reservation) => ACTIVE_BOOKING_STATUSES.includes(reservation.status)).length,
        futureActive: futureActiveReservations.length,
        arrivalsToday,
        checkoutsToday,
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
        where: { isActive: true, deletedAt: null },
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
    const bookingsInRange = allReservations.filter(
      (reservation) => reservation.checkInDate >= rangeStart && reservation.checkInDate < rangeEnd,
    );
    const occupancyReservations = allReservations.filter(
      (reservation) => reservation.checkInDate < rangeEnd && reservation.checkOutDate > rangeStart,
    );

    bookingsInRange.forEach((reservation) => {
      const revenue = toNumber(reservation.totalAmount);
      const buildingLabel = reservation.room?.building?.code || reservation.room?.building?.name || 'Chưa rõ';
      const roomTypeLabel = reservation.room?.roomType?.name || 'Chưa rõ';
      const sourceLabel = reservation.source?.trim() || 'Chưa rõ';
      const checkInKey = reservation.checkInDate.toISOString().slice(0, 10);

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

      const dayRow = dailyRevenueMap.get(checkInKey) ?? { date: checkInKey, revenue: 0, bookings: 0 };
      dayRow.revenue += revenue;
      dayRow.bookings += 1;
      dailyRevenueMap.set(checkInKey, dayRow);

      const room = rooms.find((item) => item.number === reservation.room?.number && item.building?.code === reservation.room?.building?.code);
      if (!room) return;
      const metric = roomMetrics.get(room.id);
      if (!metric) return;
      metric.bookings += 1;
      metric.revenue += revenue;
      metric.avgStay += reservation.totalNights ?? nightsBetween(reservation.checkInDate, reservation.checkOutDate);
    });

    sourceReservations
      .filter((reservation) => reservation.checkInDate >= rangeStart && reservation.checkInDate < rangeEnd)
      .forEach((reservation) => {
        const revenue = toNumber(reservation.totalAmount);
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
      // Sum each booking separately using its manually entered nightly rate.
      // overlapNights prorates bookings crossing the selected report boundary.
      metric.bookedNightRevenue += toNumber(reservation.pricePerNight) * occupiedNights;
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
}

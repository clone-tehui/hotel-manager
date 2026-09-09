import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardService } from '../dashboard/dashboard.service';
import {
  BusinessPeriod,
  breakEvenMetrics,
  businessPeriods,
  dateKey,
  endOfCalendarMonth,
  getVnParts,
} from '../dashboard/business-truth';

type FreshnessStatus = 'FRESH' | 'STALE' | 'UNKNOWN';
type MetricStatus = 'AVAILABLE' | 'UNAVAILABLE' | 'ASSUMPTION';

function monthSegments(period: BusinessPeriod) {
  const from = new Date(`${period.from}T00:00:00+07:00`);
  const to = new Date(`${period.to}T00:00:00+07:00`);
  const segments: Array<{ monthKey: string; from: string; to: string }> = [];
  let cursor = { ...getVnParts(from) };
  const finish = getVnParts(to);
  while (cursor.year < finish.year || (cursor.year === finish.year && cursor.month <= finish.month)) {
    const first = cursor.year === getVnParts(from).year && cursor.month === getVnParts(from).month
      ? { year: cursor.year, month: cursor.month, day: getVnParts(from).day }
      : { year: cursor.year, month: cursor.month, day: 1 };
    const lastOfMonth = endOfCalendarMonth(cursor);
    const last = cursor.year === finish.year && cursor.month === finish.month
      ? { year: finish.year, month: finish.month, day: finish.day }
      : lastOfMonth;
    segments.push({ monthKey: `${cursor.year}-${String(cursor.month).padStart(2, '0')}`, from: dateKey(first), to: dateKey(last) });
    cursor = cursor.month === 12 ? { year: cursor.year + 1, month: 1, day: 1, weekday: 0 } : { year: cursor.year, month: cursor.month + 1, day: 1, weekday: 0 };
  }
  return segments;
}

@Injectable()
export class RoomIntelligenceService {
  constructor(private readonly prisma: PrismaService, private readonly dashboard: DashboardService) {}

  periods(now = new Date()) { return businessPeriods(now); }

  async getRoomEconomics(input: { periodKeys?: string[]; roomIds?: string[]; now?: Date }) {
    const generatedAt = new Date();
    const periods = this.periods(input.now ?? generatedAt).filter((period) => !input.periodKeys?.length || input.periodKeys.includes(period.key));
    const rooms = await this.prisma.room.findMany({
      where: { isActive: true, deletedAt: null, ...(input.roomIds?.length ? { id: { in: input.roomIds } } : {}) },
      select: { id: true, number: true, status: true, price: true, discountablePrice: true, monthlyCost: true, updatedAt: true, building: { select: { id: true, code: true, name: true } }, roomType: { select: { id: true, name: true } } },
      orderBy: [{ building: { code: 'asc' } }, { number: 'asc' }],
    });
    const roomById = new Map(rooms.map((room) => [room.id, room]));
    const output = [] as any[];
    for (const period of periods) {
      const report: any = await this.dashboard.getReport(period.from, period.to);
      for (const row of report.occupancy?.byRoom ?? []) {
        const room: any = roomById.get(row.roomId);
        if (!room) continue;
        const bookedNights = Number(row.occupiedNights ?? 0);
        const calendarNights = Number(row.totalNightsInPeriod ?? 0);
        const currentOperationallySellable = room.status !== 'MAINTENANCE';
        const sellableNights = currentOperationallySellable ? calendarNights : 0;
        // The schema has only the room's current operational status. It cannot prove
        // historical sellability for a past/future day, so no period is labelled AVAILABLE.
        const availabilityStatus: MetricStatus = 'ASSUMPTION';
        const revenue = Number(row.bookedNightRevenue ?? 0);
        const vacantNights = Math.max(0, sellableNights - bookedNights);
        const adr = bookedNights > 0 ? revenue / bookedNights : null;
        const revPar = sellableNights > 0 ? revenue / sellableNights : null;
        const economics = breakEvenMetrics(room.monthlyCost, revenue, bookedNights, vacantNights);
        output.push({
          roomId: room.id,
          roomCode: room.number,
          roomNumber: room.number,
          building: room.building,
          roomType: room.roomType,
          operationalStatus: room.status,
          period,
          monthSegments: monthSegments(period),
          availability: { sellableNights, vacantNights, status: availabilityStatus, assumption: 'Schema hiện không có lịch sử blocked/owner-stay/maintenance theo từng ngày; current MAINTENANCE được coi là không sellable cho toàn kỳ, trạng thái khác dùng calendar nights.' },
          bookedNights,
          occupancy: sellableNights > 0 ? Number(((bookedNights / sellableNights) * 100).toFixed(1)) : null,
          bookedNightRevenue: revenue,
          adr,
          revPar,
          economics,
          referencePrice: room.price == null ? null : Number(room.price),
          discountablePrice: room.discountablePrice == null ? null : Number(room.discountablePrice),
          priceFloor: { value: room.discountablePrice == null ? null : Number(room.discountablePrice), status: room.discountablePrice == null ? 'UNAVAILABLE' : 'AVAILABLE', semantics: 'Current domain field discountablePrice; not assumed to include channel commissions or variable cost.' },
          unavailable: {
            bookingPace: 'UNAVAILABLE', pickup: 'UNAVAILABLE', leadTime: 'UNAVAILABLE', lengthOfStay: 'UNAVAILABLE', cancellationIndicators: 'UNAVAILABLE', gaps: 'UNAVAILABLE', campaignResults: 'UNAVAILABLE', forecast: 'UNAVAILABLE', expectedTarget: 'UNAVAILABLE',
          },
          metricProvenance: {
            bookedNights: { status: 'AVAILABLE' as MetricStatus, source: 'dashboard-report.occupancy.byRoom[].occupiedNights', freshness: 'UNKNOWN' as FreshnessStatus },
            bookedNightRevenue: { status: 'AVAILABLE' as MetricStatus, source: 'dashboard-report.occupancy.byRoom[].bookedNightRevenue', freshness: 'UNKNOWN' as FreshnessStatus },
            occupancy: { status: availabilityStatus, source: 'derived: bookedNights / assumed sellableNights', freshness: 'UNKNOWN' as FreshnessStatus },
            adr: { status: 'AVAILABLE' as MetricStatus, source: 'derived: bookedNightRevenue / bookedNights', freshness: 'UNKNOWN' as FreshnessStatus },
            revPar: { status: availabilityStatus, source: 'derived: bookedNightRevenue / assumed sellableNights', freshness: 'UNKNOWN' as FreshnessStatus },
            economics: { status: room.monthlyCost == null ? 'UNAVAILABLE' as MetricStatus : 'AVAILABLE' as MetricStatus, source: 'derived: rooms.monthlyCost + dashboard occupancy revenue', freshness: 'UNKNOWN' as FreshnessStatus },
            referencePrice: { status: room.price == null ? 'UNAVAILABLE' as MetricStatus : 'AVAILABLE' as MetricStatus, source: 'rooms.price', freshness: room.updatedAt ? 'FRESH' as FreshnessStatus : 'UNKNOWN' as FreshnessStatus },
            priceFloor: { status: room.discountablePrice == null ? 'UNAVAILABLE' as MetricStatus : 'AVAILABLE' as MetricStatus, source: 'rooms.discountablePrice', freshness: room.updatedAt ? 'FRESH' as FreshnessStatus : 'UNKNOWN' as FreshnessStatus },
            availability: { status: availabilityStatus, source: 'rooms.status + calendar period; no daily inventory history', freshness: room.updatedAt ? 'FRESH' as FreshnessStatus : 'UNKNOWN' as FreshnessStatus },
          },
          source: { generatedAt: generatedAt.toISOString(), roomSourceUpdatedAt: room.updatedAt.toISOString(), reportCalculatedAt: generatedAt.toISOString(), freshnessStatus: 'UNKNOWN' as FreshnessStatus, systems: ['rooms', 'reservations', 'dashboard-report'], limitation: 'Reservation and daily inventory source update timestamps are not available from dashboard-report; aggregate freshness is therefore UNKNOWN.' },
        });
      }
    }
    return { generatedAt: generatedAt.toISOString(), businessTimezone: 'Asia/Ho_Chi_Minh', periods, roomCount: rooms.length, rows: output };
  }
}

export { monthSegments };

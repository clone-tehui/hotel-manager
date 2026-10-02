import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { Response } from 'express';

const VN_TZ_OFFSET_HOURS = 7;
const ACTIVE_SOURCE_LABELS = [
  { key: 'airbnb', label: 'Airbnb' },
  { key: 'trip', label: 'Trip.com' },
  { key: 'agoda', label: 'Agoda' },
  { key: 'booking', label: 'Booking.com' },
  { key: 'zalo', label: 'Zalo' },
  { key: 'sale', label: 'Sale' },
  { key: 'khac', label: 'Khác' },
] as const;

function vietnamTodayRange() {
  const now = new Date();
  const vn = new Date(now.getTime() + VN_TZ_OFFSET_HOURS * 60 * 60 * 1000);
  const start = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), -VN_TZ_OFFSET_HOURS));
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function normalizeSource(value: string | null | undefined) {
  const source = String(value || '').trim().toLowerCase();
  if (source.includes('airbnb')) return 'airbnb';
  if (source.includes('trip')) return 'trip';
  if (source.includes('agoda')) return 'agoda';
  if (source.includes('booking') || source.includes('bking')) return 'booking';
  if (source.includes('zalo')) return 'zalo';
  if (source.includes('sale')) return 'sale';
  return 'khac';
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

@Injectable()
export class TimelineService {
  constructor(private prisma: PrismaService) {}

  async getTimelineData(query: { from?: string; to?: string; buildingId?: string; status?: string }) {
    const { from, to, buildingId, status } = query;
    const where: any = {
      deletedAt: null,
    };

    const requestedStatuses = status
      ? status.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    if (requestedStatuses.length > 0) {
      where.status = { in: requestedStatuses.filter((value) => value !== 'CANCELLED') };
    } else {
      where.status = { not: 'CANCELLED' };
    }

    if (from || to) {
      const overlapping: any[] = [];
      if (to) overlapping.push({ checkInDate: { lte: new Date(to) } });
      if (from) overlapping.push({ checkOutDate: { gte: new Date(from) } });
      if (overlapping.length) where.AND = overlapping;
    }

    if (buildingId) {
      where.room = {
        buildingId,
        deletedAt: null,
        isActive: true,
      };
    }

    const reservations = await this.prisma.reservation.findMany({
      where,
      select: {
        id: true,
        roomId: true,
        reservationCode: true,
        primaryGuestName: true,
        company: true,
        checkInDate: true,
        checkOutDate: true,
        actualCheckIn: true,
        actualCheckOut: true,
        status: true,
        adults: true,
        children: true,
        notes: true,
        ratePlanName: true,
        guests: {
          select: {
            isPrimary: true,
            guest: {
              select: {
                gender: true,
                nationality: true,
              },
            },
          },
        },
        room: {
          select: {
            id: true,
            number: true,
            floor: true,
            status: true,
            buildingId: true,
            roomTypeId: true,
            building: { select: { id: true, code: true, name: true } },
            roomType: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { checkInDate: 'asc' },
    });

    return reservations.map((reservation) => {
      const primaryGuestProfile = reservation.guests.find((guest) => guest.isPrimary)?.guest ?? reservation.guests[0]?.guest;
      return {
        ...reservation,
        primaryGuestGender: primaryGuestProfile?.gender ?? null,
        primaryGuestNationality: primaryGuestProfile?.nationality ?? null,
        checkInDateFormatted: formatHotelDateTime(reservation.checkInDate),
        checkOutDateFormatted: formatHotelDateTime(reservation.checkOutDate),
      };
    });
  }

  async getTodayInHouseBySource(buildingId?: string) {
    const { start, end } = vietnamTodayRange();
    const reservations = await this.prisma.reservation.findMany({
      where: {
        deletedAt: null,
        status: 'IN_HOUSE',
        checkInDate: { lt: end },
        checkOutDate: { gt: start },
        ...(buildingId ? { room: { buildingId } } : {}),
      },
      select: { roomId: true, source: true },
    });
    const bySource = new Map<string, Set<string>>();
    reservations.forEach((reservation) => {
      const key = normalizeSource(reservation.source);
      const rooms = bySource.get(key) ?? new Set<string>();
      rooms.add(reservation.roomId);
      bySource.set(key, rooms);
    });
    return {
      total: new Set(reservations.map((reservation) => reservation.roomId)).size,
      bySource: ACTIVE_SOURCE_LABELS.map(({ key, label }) => ({ key, label, rooms: bySource.get(key)?.size ?? 0 })),
    };
  }

  async exportTimeline(query: any, res: Response) {
    const { from, to, status, buildingId, format = 'xlsx' } = query;

    const reservations = await this.getTimelineData({ from, to, status, buildingId });

    // Get business settings from DB
    const settings = await this.prisma.systemSetting.findMany({
      where: { key: { in: ['business_name', 'business_address', 'business_phone', 'business_email'] } },
    });
    const cfg: Record<string, string> = {};
    settings.forEach((s) => { cfg[s.key] = s.value; });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Báo cáo đặt phòng');

    // Business header
    worksheet.addRow([cfg['business_name'] || 'Apartment Management']);
    worksheet.addRow([cfg['business_address'] || '']);
    worksheet.addRow([`${cfg['business_email'] || ''} | ${cfg['business_phone'] || ''}`]);
    worksheet.addRow([]);

    const titleRow = worksheet.addRow(['DANH SÁCH ĐẶT CĂN HỘ']);
    titleRow.font = { bold: true, size: 14 };

    let statusStr = 'Tất cả';
    if (status) {
      const map: Record<string, string> = {
        'BOOKED': 'Đã đặt', 'PENDING_CHECKIN': 'Khách sẽ đến', 'IN_HOUSE': 'Đang ở',
        'CHECKED_OUT': 'Đã trả', 'CANCELLED': 'Đã huỷ',
      };
      statusStr = status.split(',').map((s: string) => map[s] || s).join(', ');
    }

    worksheet.addRow([`Trạng thái: ${statusStr}`]);
    worksheet.addRow([`Từ ngày: ${from || '...'} – Đến ngày: ${to || '...'}`]);
    if (buildingId) worksheet.addRow([`Toà nhà ID: ${buildingId}`]);
    worksheet.addRow([`Xuất lúc: ${new Date().toLocaleString('vi-VN')}`]);
    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['#', 'Căn/Phòng', 'Toà nhà', 'Tên khách', 'Ngày đến', 'Ngày đi', 'Loại giá', 'NL/TE', 'Công ty', 'Ghi chú']);
    headerRow.font = { bold: true };
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    reservations.forEach((r: any, index: number) => {
      const row = worksheet.addRow([
        index + 1,
        r.room?.number || '',
        r.room?.building?.name || '',
        r.primaryGuestName || '',
        new Date(r.checkInDate).toLocaleDateString('vi-VN'),
        new Date(r.checkOutDate).toLocaleDateString('vi-VN'),
        r.ratePlanName || '',
        `${r.adults}/${r.children}`,
        r.company || '',
        r.notes || '',
      ]);
      row.eachCell((cell) => {
        cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
      });
    });

    [5, 12, 15, 22, 12, 12, 15, 8, 20, 30].forEach((w, i) => { worksheet.getColumn(i + 1).width = w; });

    const ts = new Date().getTime();
    if (format === 'csv') {
      res.header('Content-Type', 'text/csv; charset=utf-8');
      res.header('Content-Disposition', `attachment; filename=dat_phong_${ts}.csv`);
      await workbook.csv.write(res);
    } else {
      res.header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.header('Content-Disposition', `attachment; filename=dat_phong_${ts}.xlsx`);
      await workbook.xlsx.write(res);
    }
    res.end();
  }
}

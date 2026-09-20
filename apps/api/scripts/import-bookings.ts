import ExcelJS from 'exceljs';
import { GuestGender, PrismaClient, ReservationStatus, RoomStatus } from '@prisma/client';

const prisma = new PrismaClient();

type ImportRow = {
  rowNumber: number;
  bookingId: string;
  roomLabel: string;
  guestName: string;
  checkInDate: Date;
  checkOutDate: Date;
  ratePlanName?: string;
  adults: number;
  children: number;
  company?: string;
  notes?: string;
  internalNotes?: string;
  dateOfBirth?: Date;
  gender?: GuestGender;
  phone?: string;
  email?: string;
  idNumber?: string;
  idType: 'NATIONAL_ID' | 'PASSPORT';
  address?: string;
  nationality?: string;
  source?: string;
  // Price is optional because some exports omit the “Giá phòng” column.
  // Those files must not erase financial values already stored on a booking.
  pricePerNight?: number;
  totalNights: number;
  createdBy?: string;
  createdAt?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
};

type ParsedRoom = {
  buildingCode: string;
  buildingName: string;
  number: string;
  roomTypeName: string;
  floor: number | null;
};

type ImportStats = Record<'buildingsCreated' | 'roomTypesCreated' | 'roomsCreated' | 'roomsUpdated' | 'guestsCreated' | 'guestsUpdated' | 'reservationsCreated' | 'reservationsUpdated' | 'reservationsSkippedDuplicate' | 'reservationsSkippedMaintenance', number>;

function createStats(): ImportStats {
  return {
    buildingsCreated: 0,
    roomTypesCreated: 0,
    roomsCreated: 0,
    roomsUpdated: 0,
    guestsCreated: 0,
    guestsUpdated: 0,
    reservationsCreated: 0,
    reservationsUpdated: 0,
    reservationsSkippedDuplicate: 0,
    reservationsSkippedMaintenance: 0,
  };
}

let stats = createStats();

function readCell(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  if (typeof value === 'object') {
    const item = value as any;
    if (Array.isArray(item.richText)) return item.richText.map((part: any) => part?.text || '').join('');
    if (item.text != null) return String(item.text);
    if (item.result != null) return String(item.result);
  }
  return String(value);
}

function headerKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('vi-VN');
}

function cellValue(row: ExcelJS.Row, headers: Map<string, number>, name: string): ExcelJS.CellValue {
  const index = headers.get(headerKey(name));
  return index ? row.getCell(index).value : null;
}

function text(value: ExcelJS.CellValue): string {
  return readCell(value).replace(/\s+/g, ' ').trim();
}

function emptyToUndefined(value: string): string | undefined {
  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function localDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour - 7, minute, second));
}

function parseDate(value: ExcelJS.CellValue): Date | undefined {
  if (value == null || value === '') return undefined;
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return undefined;
    return localDate(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate(), value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds());
  }
  if (typeof value === 'number') {
    const utc = new Date(Math.round((value - 25569) * 86400 * 1000));
    return localDate(utc.getUTCFullYear(), utc.getUTCMonth() + 1, utc.getUTCDate(), utc.getUTCHours(), utc.getUTCMinutes(), utc.getUTCSeconds());
  }
  if (typeof value === 'object') {
    const formulaResult = (value as any).result;
    if (formulaResult != null) return parseDate(formulaResult as ExcelJS.CellValue);
  }
  const raw = text(value);
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!match) throw new Error(`Không đọc được ngày: ${raw}`);
  return localDate(Number(match[3]), Number(match[2]), Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
}

function optionalDate(value: ExcelJS.CellValue, rowNumber: number, label: string): Date | undefined {
  try {
    return parseDate(value);
  } catch (error: any) {
    throw new Error(`Dòng ${rowNumber}: không đọc được ${label} (${error?.message || error})`);
  }
}

function parseNumber(value: ExcelJS.CellValue, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = text(value).replace(/[^0-9,.-]/g, '').replace(/,/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : fallback;
}

function parseGuests(value: string): { adults: number; children: number } {
  const match = value.match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return { adults: 1, children: 0 };
  return { adults: Math.max(1, Number(match[1])), children: Math.max(0, Number(match[2])) };
}

function parseGender(value: string): GuestGender | undefined {
  const normalized = value.trim().toLocaleLowerCase('vi-VN');
  if (normalized === 'nam') return GuestGender.MALE;
  if (normalized === 'nữ' || normalized === 'nu') return GuestGender.FEMALE;
  return undefined;
}

function normalizePhone(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 8) return undefined;
  return raw.startsWith('+') ? `+${digits}` : digits;
}

function phoneFromGuestLabel(value: string): string | undefined {
  const match = value.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return match ? normalizePhone(match[1]) : undefined;
}

function guestNameFromLabel(value: string): string {
  const withoutPhone = value.replace(/\s*-?\s*\+?\d[\d\s().-]{7,}\d\s*$/, '').trim();
  const withoutChannelPrefix = withoutPhone.replace(/^(bnb|kl|sale)\s+/i, '').trim();
  return withoutChannelPrefix || value.trim();
}

function normalizeSource(value: string): string | undefined {
  const normalized = value.trim().toLocaleLowerCase('vi-VN');
  if (!normalized) return undefined;
  if (normalized.includes('airbnb')) return 'airbnb';
  if (normalized.includes('zalo')) return 'zalo';
  if (normalized.includes('sale')) return 'sale';
  return 'khac';
}

function reservationStatus(row: ImportRow): ReservationStatus {
  if (row.cancelledAt || row.cancelReason) return ReservationStatus.CANCELLED;
  const now = new Date();
  if (row.checkOutDate.getTime() <= now.getTime()) return ReservationStatus.CHECKED_OUT;
  if (row.checkInDate.getTime() <= now.getTime()) return ReservationStatus.IN_HOUSE;
  return ReservationStatus.BOOKED;
}

function parseRoom(label: string): ParsedRoom {
  const raw = label.replace(/\s+/g, ' ').trim();
  const known = raw.match(/^(Opera|Galleria|Crest|Vic29)\s+(.+)$/i);
  let buildingName = 'Khác';
  let buildingCode = 'KHAC';
  let details = raw;

  if (known) {
    buildingName = known[1].replace(/^./, (character) => character.toUpperCase());
    buildingCode = buildingName.toUpperCase();
    details = known[2].trim();
  }

  // The source uses both 2PN and malformed variations such as 2P or 2.
  // Store the bedroom count only in the room type and keep the unit code clean.
  const bedroomMatch = details.match(/(?:^|\s)([1-5])\s*P(?:N)?(?=\s|$)|(?:^|\s)([1-5])(?=\s|$)/i);
  const bedrooms = bedroomMatch?.[1] || bedroomMatch?.[2];
  const roomTypeName = bedrooms ? `${bedrooms}PN` : 'Không phân loại';
  let number = details
    .replace(bedroomMatch?.[0] || '', ' ')
    .replace(/\bN\/A\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim() || raw;
  const numberParts = number.split(' ');
  if (numberParts.length === 2 && numberParts[0] === numberParts[1]) number = numberParts[0];
  const floorMatch = number.match(/[A-Z]+(\d+)(?:[AB])?\./i);

  return {
    buildingCode,
    buildingName,
    number,
    roomTypeName,
    floor: floorMatch ? Number(floorMatch[1]) : null,
  };
}

function uniqueReservationCode(
  bookingId: string,
  rowNumber: number,
  seen: Map<string, number>,
  reservationPrefix: string,
): string {
  const base = `${reservationPrefix}-${bookingId}`;
  const count = seen.get(base) || 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-R${rowNumber}`;
}

function noteValue(label: string, value: string | undefined): string | undefined {
  return value ? `${label}: ${value}` : undefined;
}

async function readWorkbook(workbookPath: string): Promise<ImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Workbook không có worksheet');

  let headerRowNumber = 0;
  const headers = new Map<string, number>();
  worksheet.eachRow((row, rowNumber) => {
    if (headerRowNumber) return;
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell) => values.push(text(cell.value)));
    if (values.includes('#') && values.includes('Phòng')) {
      headerRowNumber = rowNumber;
      row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
        const label = text(cell.value);
        if (!label) return;
        const key = headerKey(label);
        const notesKey = headerKey('Ghi chú');
        if (key === notesKey && headers.has(key)) {
          headers.set(headerKey('Ghi chú.1'), columnNumber);
          return;
        }
        headers.set(key, columnNumber);
      });
    }
  });

  if (!headerRowNumber) throw new Error('Không tìm thấy dòng tiêu đề có cột # và Phòng');
  const rows: ImportRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;
    const bookingId = text(cellValue(row, headers, '#'));
    // ezCloud inserts merged "group note" rows between bookings. Their text is
    // repeated into every cell, including the # column, so only numeric source
    // identifiers are real reservation rows in this export.
    if (!/^\d+$/.test(bookingId)) return;

    let checkInDate: Date | undefined;
    let checkOutDate: Date | undefined;
    try {
      checkInDate = parseDate(cellValue(row, headers, 'Ngày đến'));
      checkOutDate = parseDate(cellValue(row, headers, 'Ngày đi'));
    } catch (error: any) {
      throw new Error(`Dòng ${rowNumber}: không đọc được ngày đến/ngày đi (${error?.message || error})`);
    }
    if (!checkInDate || !checkOutDate) {
      throw new Error(`Dòng ${rowNumber}: ngày đến/ngày đi không hợp lệ`);
    }
    const declaredNights = Math.max(1, Math.round(parseNumber(cellValue(row, headers, 'Số đêm'), Math.round((checkOutDate.getTime() - checkInDate.getTime()) / 86400000))));
    // Four source rows have the same arrival/departure timestamp while their
    // declared stay is one night. Make that implicit night explicit so the
    // reservation satisfies the timeline's required positive duration.
    if (checkOutDate.getTime() === checkInDate.getTime()) {
      checkOutDate = new Date(checkInDate.getTime() + declaredNights * 86400000);
    }
    if (checkOutDate.getTime() < checkInDate.getTime()) {
      throw new Error(`Dòng ${rowNumber}: ngày đến/ngày đi không hợp lệ`);
    }

    const guestLabel = text(cellValue(row, headers, 'Tên khách'));
    const guests = parseGuests(text(cellValue(row, headers, 'NL/TE')));
    const noteParts = [text(cellValue(row, headers, 'Ghi chú')), text(cellValue(row, headers, 'Ghi chú.1'))].filter(Boolean);
    const internalNotes = [
      noteValue('Mã booking nguồn', bookingId),
      noteValue('Tên khách nguồn', guestLabel),
      noteValue('Mã OTA', emptyToUndefined(text(cellValue(row, headers, 'Mã OTA')))),
      noteValue('Nguồn gốc', emptyToUndefined(text(cellValue(row, headers, 'Nguồn')))),
      noteValue('Thị trường', emptyToUndefined(text(cellValue(row, headers, 'Thị trường')))),
      noteValue('Hoa hồng', emptyToUndefined(text(cellValue(row, headers, 'Hoa hồng')))),
      noteValue('Giá chưa hoa hồng', emptyToUndefined(text(cellValue(row, headers, 'Giá chưa hoa hồng')))),
      noteValue('Giá bao gồm hoa hồng', emptyToUndefined(text(cellValue(row, headers, 'Giá bao gồm hoa hồng')))),
      noteValue('Nhãn phòng gốc', text(cellValue(row, headers, 'Phòng'))),
    ].filter(Boolean).join('\n');

    const idNumber = emptyToUndefined(text(cellValue(row, headers, 'CMND'))) || emptyToUndefined(text(cellValue(row, headers, 'Hộ chiếu')));
    rows.push({
      rowNumber,
      bookingId,
      roomLabel: text(cellValue(row, headers, 'Phòng')),
      guestName: guestNameFromLabel(guestLabel),
      checkInDate,
      checkOutDate,
      ratePlanName: emptyToUndefined(text(cellValue(row, headers, 'Loại giá'))),
      adults: guests.adults,
      children: guests.children,
      company: emptyToUndefined(text(cellValue(row, headers, 'Công ty'))),
      notes: emptyToUndefined(noteParts.join('\n')),
      internalNotes: emptyToUndefined(internalNotes),
      dateOfBirth: optionalDate(cellValue(row, headers, 'Ngày sinh'), rowNumber, 'ngày sinh'),
      gender: parseGender(text(cellValue(row, headers, 'Giới tính'))),
      phone: normalizePhone(text(cellValue(row, headers, 'SĐT'))) || phoneFromGuestLabel(guestLabel),
      email: emptyToUndefined(text(cellValue(row, headers, 'Email'))),
      idNumber,
      idType: text(cellValue(row, headers, 'CMND')) ? 'NATIONAL_ID' : 'PASSPORT',
      address: emptyToUndefined(text(cellValue(row, headers, 'Địa chỉ'))),
      nationality: emptyToUndefined(text(cellValue(row, headers, 'Thị trường'))),
      source: normalizeSource(text(cellValue(row, headers, 'Nguồn'))),
      pricePerNight: headers.has(headerKey('Giá phòng'))
        ? Math.max(0, parseNumber(cellValue(row, headers, 'Giá phòng')))
        : undefined,
      totalNights: declaredNights,
      createdBy: emptyToUndefined(text(cellValue(row, headers, 'Người tạo'))),
      createdAt: optionalDate(cellValue(row, headers, 'Ngày tạo'), rowNumber, 'ngày tạo'),
      cancelledAt: optionalDate(cellValue(row, headers, 'Ngày hủy'), rowNumber, 'ngày hủy'),
      cancelReason: emptyToUndefined(text(cellValue(row, headers, 'Lý do hủy'))),
    });
  });
  return rows;
}

async function getOrCreateBuilding(room: ParsedRoom, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(room.buildingCode);
  if (cached) return cached;
  const existing = await prisma.building.findUnique({ where: { code: room.buildingCode } });
  if (existing) {
    cache.set(room.buildingCode, existing.id);
    return existing.id;
  }
  const created = await prisma.building.create({ data: { code: room.buildingCode, name: room.buildingName, note: 'Tạo bởi import booking ChiHome' } });
  cache.set(room.buildingCode, created.id);
  stats.buildingsCreated += 1;
  return created.id;
}

async function getOrCreateRoomType(name: string, cache: Map<string, string>): Promise<string> {
  const cached = cache.get(name);
  if (cached) return cached;
  const existing = await prisma.roomType.findUnique({ where: { name } });
  if (existing) {
    cache.set(name, existing.id);
    return existing.id;
  }
  const created = await prisma.roomType.create({ data: { name, basePrice: 0, maxGuests: 2, amenities: [] } });
  cache.set(name, created.id);
  stats.roomTypesCreated += 1;
  return created.id;
}

async function getOrCreateRoom(parsed: ParsedRoom, row: ImportRow, buildingCache: Map<string, string>, roomTypeCache: Map<string, string>, roomCache: Map<string, string>): Promise<string> {
  const buildingId = await getOrCreateBuilding(parsed, buildingCache);
  const roomTypeId = await getOrCreateRoomType(parsed.roomTypeName, roomTypeCache);
  const key = `${buildingId}|${parsed.number}`;
  const cached = roomCache.get(key);
  if (cached) return cached;
  const existing = await prisma.room.findUnique({ where: { buildingId_number: { buildingId, number: parsed.number } } });
  if (existing) {
    await prisma.room.update({ where: { id: existing.id }, data: { roomTypeId, floor: parsed.floor, note: `Nhãn phòng nguồn: ${row.roomLabel}` } });
    roomCache.set(key, existing.id);
    stats.roomsUpdated += 1;
    return existing.id;
  }
  const created = await prisma.room.create({
    data: {
      buildingId,
      roomTypeId,
      number: parsed.number,
      floor: parsed.floor,
      status: RoomStatus.VACANT,
      note: `Nhãn phòng nguồn: ${row.roomLabel}`,
    },
  });
  roomCache.set(key, created.id);
  stats.roomsCreated += 1;
  return created.id;
}

async function findExistingRoom(parsed: ParsedRoom) {
  const building = await prisma.building.findUnique({ where: { code: parsed.buildingCode }, select: { id: true } });
  if (!building) return null;
  return prisma.room.findUnique({
    where: { buildingId_number: { buildingId: building.id, number: parsed.number } },
    select: { id: true, status: true },
  });
}

async function getOrCreateGuest(row: ImportRow, cache: Map<string, string>): Promise<string> {
  const identity = row.idNumber ? `id:${row.idNumber}` : `person:${row.guestName.toLocaleLowerCase('vi-VN')}|${row.phone || ''}|${row.email || ''}`;
  const cached = cache.get(identity);
  if (cached) return cached;
  const existing = row.idNumber
    ? await prisma.guest.findUnique({ where: { idNumber: row.idNumber } })
    : await prisma.guest.findFirst({ where: { fullName: row.guestName, phone: row.phone || null, email: row.email || null }, orderBy: { createdAt: 'asc' } });
  const data = {
    fullName: row.guestName,
    phone: row.phone,
    email: row.email,
    gender: row.gender,
    idType: row.idType,
    idNumber: row.idNumber,
    company: row.company,
    address: row.address,
    dateOfBirth: row.dateOfBirth,
    nationality: row.nationality,
  };
  if (existing) {
    await prisma.guest.update({ where: { id: existing.id }, data });
    cache.set(identity, existing.id);
    stats.guestsUpdated += 1;
    return existing.id;
  }
  const created = await prisma.guest.create({ data });
  cache.set(identity, created.id);
  stats.guestsCreated += 1;
  return created.id;
}

async function importRows(rows: ImportRow[], reservationPrefix: string) {
  const buildingCache = new Map<string, string>();
  const roomTypeCache = new Map<string, string>();
  const roomCache = new Map<string, string>();
  const guestCache = new Map<string, string>();
  const reservationCodes = new Map<string, number>();
  const sourceBookingIds = new Set<string>();

  for (const row of rows) {
    const parsedRoom = parseRoom(row.roomLabel);
    const baseReservationCode = `${reservationPrefix}-${row.bookingId}`;
    // An import may be re-run with the same file or contain repeated source
    // rows. Keep existing bookings unchanged instead of updating them.
    if (sourceBookingIds.has(row.bookingId) || await prisma.reservation.findUnique({ where: { reservationCode: baseReservationCode }, select: { id: true } })) {
      sourceBookingIds.add(row.bookingId);
      stats.reservationsSkippedDuplicate += 1;
      continue;
    }
    sourceBookingIds.add(row.bookingId);

    // Maintenance is an intentional operational exclusion. Do this check
    // before creating/updating a room or guest, so the import leaves that
    // apartment and its data completely untouched.
    const existingRoom = await findExistingRoom(parsedRoom);
    if (existingRoom?.status === RoomStatus.MAINTENANCE) {
      stats.reservationsSkippedMaintenance += 1;
      continue;
    }
    const roomId = await getOrCreateRoom(parsedRoom, row, buildingCache, roomTypeCache, roomCache);
    const guestId = await getOrCreateGuest(row, guestCache);
    const reservationCode = uniqueReservationCode(row.bookingId, row.rowNumber, reservationCodes, reservationPrefix);
    const status = reservationStatus(row);
    const pricingData = row.pricePerNight === undefined
      ? {}
      : {
          pricePerNight: row.pricePerNight,
          totalAmount: row.pricePerNight * row.totalNights,
        };
    const data = {
      roomId,
      primaryGuestName: row.guestName,
      company: row.company,
      checkInDate: row.checkInDate,
      checkOutDate: row.checkOutDate,
      adults: row.adults,
      children: row.children,
      ratePlanName: row.ratePlanName,
      totalNights: row.totalNights,
      ...pricingData,
      status,
      cancelledAt: status === ReservationStatus.CANCELLED ? row.cancelledAt : null,
      cancelReason: status === ReservationStatus.CANCELLED ? row.cancelReason : null,
      source: row.source,
      notes: row.notes,
      internalNotes: row.internalNotes,
      createdBy: row.createdBy,
      createdAt: row.createdAt,
    };
    const reservation = await prisma.reservation.create({
      data: {
        ...data,
        reservationCode,
        // New records from a price-less export have no revenue supplied.
        pricePerNight: row.pricePerNight ?? 0,
        totalAmount: row.pricePerNight === undefined ? 0 : row.pricePerNight * row.totalNights,
      },
    });
    stats.reservationsCreated += 1;
    await prisma.reservationGuest.upsert({
      where: { reservationId_guestId: { reservationId: reservation.id, guestId } },
      update: { isPrimary: true },
      create: { reservationId: reservation.id, guestId, isPrimary: true },
    });
  }
}

export async function importBookingsFromWorkbook(
  workbookPath: string,
  reservationPrefix = 'CHIH',
): Promise<{ importedRows: number } & ImportStats> {
  stats = createStats();
  const rows = await readWorkbook(workbookPath);
  await importRows(rows, reservationPrefix);
  return { importedRows: rows.length, ...stats };
}

export async function disconnectBookingImporter() {
  await prisma.$disconnect();
}

// This package runs as an ES module in the production image. Checking the
// invoked script path works in both the ts-node import command and compiled
// execution without relying on CommonJS's `require.main`.
const isDirectExecution = process.argv[1]?.endsWith('import-bookings.ts') || process.argv[1]?.endsWith('import-bookings.js');

if (isDirectExecution) {
  const workbookPath = process.argv[2];
  const reservationPrefix = process.argv[3] || 'CHIH';
  if (!workbookPath) {
    console.error('Usage: pnpm ts-node scripts/import-bookings.ts <xlsx-path> [reservation-prefix]');
    process.exitCode = 1;
  } else {
    importBookingsFromWorkbook(workbookPath, reservationPrefix)
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      })
      .finally(disconnectBookingImporter);
  }
}

import * as ExcelJS from 'exceljs';
import { PrismaClient, RoomStatus } from '@prisma/client';
import { normalizeImportedRoomCode } from './room-pricing-normalization';

const prisma = new PrismaClient();
const workbookPath = process.argv[2];

if (!workbookPath) {
  console.error('Usage: ts-node scripts/import-room-pricing.ts <xlsx-path>');
  process.exit(1);
}

type PriceRow = {
  rowNumber: number;
  bedrooms: string;
  rawCode: string;
  code: string;
  buildingCode: string;
  price: number | null;
  discountablePrice: number | null;
  note: string;
};

function readCell(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'object') {
    const anyValue = value as any;
    if (Array.isArray(anyValue.richText)) return anyValue.richText.map((item: any) => item?.text || '').join('');
    if (anyValue.text != null) return String(anyValue.text);
    if (anyValue.result != null) return String(anyValue.result);
    if (anyValue.hyperlink) return String(anyValue.text || anyValue.hyperlink || '');
    return '';
  }
  return String(value);
}

function detectBuildingCode(raw: string): string {
  const text = String(raw || '');
  if (/galleria/i.test(text)) return 'GALLERIA';
  if (/crest/i.test(text)) return 'CREST';
  if (/lancaster/i.test(text)) return 'LANCASTER';
  if (/vin/i.test(text) || /biet th|biệt thự/i.test(text) || /vic\d+/i.test(text)) return 'BIỆT THỰ';
  return 'OPERA';
}

function roomTypeNameFromBedrooms(value: string): string {
  const normalized = String(value || '').trim().toUpperCase();
  if (normalized === '1PN') return '1 Phòng Ngủ';
  if (normalized === '2PN') return '2 Phòng Ngủ';
  if (normalized === '3PN') return '3 Phòng Ngủ';
  if (normalized === '4PN') return '4 Phòng Ngủ';
  if (normalized === '5PN') return '5 Phòng Ngủ';
  if (/BIỆT THỰ|BIET THU/.test(normalized)) return 'BIỆT THỰ';
  throw new Error(`Không map được loại phòng từ nhãn phòng ngủ: ${value}`);
}

function parsePriceToVnd(value: string): number | null {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return null;
  const numeric = raw.replace(/tr/g, '').replace(/,/g, '.').replace(/[^\d.]/g, '');
  if (!numeric) return null;
  const num = Number(numeric);
  if (!Number.isFinite(num)) return null;
  return Math.round(num * 1_000_000);
}

function inferFloor(roomCode: string): number | null {
  const match = String(roomCode || '').match(/^[A-Z]+(\d+)([AB])?(?:\.|$)/i);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = String(match[2] || '').toUpperCase();
  if (suffix === 'A') return base + 1;
  if (suffix === 'B') return base + 2;
  return base;
}

async function loadRows(): Promise<PriceRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const worksheet = workbook.worksheets[0];
  let currentBedrooms = '';
  const rows: PriceRow[] = [];

  worksheet.eachRow((row, rowNumber) => {
    const colA = readCell(row.getCell(1).value).trim();
    const colB = readCell(row.getCell(2).value).trim();
    const colC = readCell(row.getCell(3).value).trim();
    const colD = readCell(row.getCell(4).value).trim();
    const colE = readCell(row.getCell(5).value).trim();

    if (colA) currentBedrooms = colA;
    if (!colB || colB === 'Mã căn' || colB === 'The Opera' || colB === 'Biệt thự') return;

    rows.push({
      rowNumber,
      bedrooms: currentBedrooms,
      rawCode: colB,
      code: normalizeImportedRoomCode(colB),
      buildingCode: detectBuildingCode(colB),
      price: parsePriceToVnd(colC),
      discountablePrice: parsePriceToVnd(colD),
      note: colE,
    });
  });

  return rows;
}

async function main() {
  const rows = await loadRows();
  const buildings = await prisma.building.findMany({ select: { id: true, code: true } });
  const roomTypes = await prisma.roomType.findMany({ select: { id: true, name: true } });
  const buildingMap = new Map(buildings.map((item) => [item.code, item.id]));
  const roomTypeMap = new Map(roomTypes.map((item) => [item.name, item.id]));

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const buildingId = buildingMap.get(row.buildingCode);
    if (!buildingId) throw new Error(`Thiếu building ${row.buildingCode} cho dòng Excel ${row.rowNumber}`);

    const roomTypeName = roomTypeNameFromBedrooms(row.bedrooms);
    const roomTypeId = roomTypeMap.get(roomTypeName);
    if (!roomTypeId) throw new Error(`Thiếu room type ${roomTypeName} cho dòng Excel ${row.rowNumber}`);

    const existing = await prisma.room.findUnique({
      where: { buildingId_number: { buildingId, number: row.code } },
      select: { id: true, note: true },
    });

    const note = row.note || undefined;

    if (existing) {
      await prisma.room.update({
        where: { id: existing.id },
        data: {
          price: row.price,
          discountablePrice: row.discountablePrice,
        },
      });
      updated += 1;
      continue;
    }

    await prisma.room.create({
      data: {
        number: row.code,
        floor: inferFloor(row.code),
        buildingId,
        roomTypeId,
        status: RoomStatus.VACANT,
        isActive: true,
        price: row.price,
        discountablePrice: row.discountablePrice,
        note,
      },
    });
    created += 1;
  }

  console.log(JSON.stringify({ importedRows: rows.length, updated, created }, null, 2));
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

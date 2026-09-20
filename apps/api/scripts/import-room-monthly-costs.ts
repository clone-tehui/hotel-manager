import ExcelJS from 'exceljs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Confirmed aliases where the source workbook and the room registry use
// different but equivalent room-code spellings.
const CONFIRMED_ADDITIONAL_TARGETS: Record<string, Array<{ buildingCode: string; roomNumber: string }>> = {
  A03A12B: [{ buildingCode: 'OPERA', roomNumber: 'A03.12B' }],
  B1807: [
    { buildingCode: 'OPERA', roomNumber: 'B18.07' },
    { buildingCode: 'KHAC', roomNumber: 'B18.07' },
  ],
  C0503: [{ buildingCode: 'GALLERIA', roomNumber: 'C05.03A' }],
  A1011: [{ buildingCode: 'KHAC', roomNumber: 'A10.11' }],
  B03A21: [{ buildingCode: 'KHAC', roomNumber: 'B3A.21' }],
};

type CostRow = {
  rowNumber: number;
  sourceLabel: string;
  normalizedCode: string;
  buildingCode?: string;
  monthlyCostMillion: number;
  pricePerNightMillion: number;
};

function cellValue(value: ExcelJS.CellValue): unknown {
  return value && typeof value === 'object' && 'result' in value ? value.result : value;
}

function parseRoomReference(value: unknown): Pick<CostRow, 'normalizedCode' | 'buildingCode'> {
  let roomCode = String(value ?? '').trim();
  const buildingName = /^(Galleria|Crest|Opera)\s+/i.exec(roomCode)?.[1]?.toUpperCase();
  roomCode = roomCode.replace(/^(Galleria|Crest|Opera)\s+/i, '').split(/\s+/)[0];
  const match = /^([A-Z]+)(\d{1,2}[A-Z]?)\.(\d{1,2}[A-Z]?)$/i.exec(roomCode);
  if (match) {
    const padNumber = (part: string) => part.replace(/\d+/, (number) => number.padStart(2, '0'));
    roomCode = `${match[1].toUpperCase()}${padNumber(match[2])}.${padNumber(match[3])}`;
  }

  return {
    normalizedCode: roomCode.replace(/[^A-Z0-9]/gi, '').toUpperCase(),
    buildingCode: buildingName === 'GALLERIA' ? 'GALLERIA' : buildingName === 'CREST' ? 'CREST' : buildingName === 'OPERA' ? 'OPERA' : undefined,
  };
}

async function readCosts(workbookPath: string): Promise<CostRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(workbookPath);
  const sheet = workbook.getWorksheet('Giá vốn từng căn');
  if (!sheet) throw new Error('Không tìm thấy sheet “Giá vốn từng căn”');

  const costs: CostRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return;
    const sourceLabel = String(cellValue(row.getCell(1).value) ?? '').trim();
    const monthlyCostMillion = Number(cellValue(row.getCell(5).value));
    const pricePerNightMillion = Number(cellValue(row.getCell(6).value));
    const rentMillion = Number(cellValue(row.getCell(2).value));
    if (!sourceLabel || !Number.isFinite(rentMillion) || !Number.isFinite(monthlyCostMillion) || monthlyCostMillion <= 0 || !Number.isFinite(pricePerNightMillion) || pricePerNightMillion <= 0) return;
    costs.push({ rowNumber, sourceLabel, ...parseRoomReference(sourceLabel), monthlyCostMillion, pricePerNightMillion });
  });
  return costs;
}

export async function importRoomMonthlyCosts(workbookPath: string) {
  const costs = await readCosts(workbookPath);
  const rooms = await prisma.room.findMany({ select: { id: true, number: true, monthlyCost: true, price: true, building: { select: { code: true } } } });
  const roomsByCode = new Map<string, typeof rooms>();
  for (const room of rooms) {
    const code = parseRoomReference(room.number).normalizedCode;
    roomsByCode.set(code, [...(roomsByCode.get(code) ?? []), room]);
  }

  const unmatched: Array<{ rowNumber: number; sourceLabel: string }> = [];
  const ambiguous: Array<{ rowNumber: number; sourceLabel: string }> = [];
  const resolvedByAlias = new Set<string>();
  let updated = 0;
  let unchanged = 0;
  let aliasUpdated = 0;

  for (const cost of costs) {
    const matches = (roomsByCode.get(cost.normalizedCode) ?? []).filter((room) => !cost.buildingCode || room.building.code === cost.buildingCode);
    if (matches.length === 0) {
      unmatched.push({ rowNumber: cost.rowNumber, sourceLabel: cost.sourceLabel });
      continue;
    }
    if (matches.length > 1) {
      ambiguous.push({ rowNumber: cost.rowNumber, sourceLabel: cost.sourceLabel });
      continue;
    }

    const room = matches[0];
    const monthlyCost = Math.round(cost.monthlyCostMillion * 1_000_000);
    const price = Math.round(cost.pricePerNightMillion * 1_000_000);
    if (room.monthlyCost !== null && Number(room.monthlyCost) === monthlyCost && room.price !== null && Number(room.price) === price) {
      unchanged += 1;
      continue;
    }
    await prisma.room.update({ where: { id: room.id }, data: { monthlyCost, price } });
    updated += 1;
  }

  for (const cost of costs) {
    const targets = CONFIRMED_ADDITIONAL_TARGETS[cost.normalizedCode] ?? [];
    if (!targets.length) continue;
    const monthlyCost = Math.round(cost.monthlyCostMillion * 1_000_000);
    const price = Math.round(cost.pricePerNightMillion * 1_000_000);
    for (const target of targets) {
      const room = rooms.find((candidate) => candidate.building.code === target.buildingCode && candidate.number === target.roomNumber);
      if (!room) continue;
      if (room.monthlyCost !== null && Number(room.monthlyCost) === monthlyCost && room.price !== null && Number(room.price) === price) continue;
      await prisma.room.update({ where: { id: room.id }, data: { monthlyCost, price } });
      aliasUpdated += 1;
    }
    resolvedByAlias.add(`${cost.rowNumber}:${cost.sourceLabel}`);
  }

  return {
    sourceRows: costs.length,
    updated,
    unchanged,
    aliasUpdated,
    unmatched: unmatched.filter((item) => !resolvedByAlias.has(`${item.rowNumber}:${item.sourceLabel}`)),
    ambiguous: ambiguous.filter((item) => !resolvedByAlias.has(`${item.rowNumber}:${item.sourceLabel}`)),
  };
}

const isDirectExecution = process.argv[1]?.endsWith('import-room-monthly-costs.ts') || process.argv[1]?.endsWith('import-room-monthly-costs.js');
if (isDirectExecution) {
  const workbookPath = process.argv[2];
  if (!workbookPath) {
    console.error('Usage: pnpm ts-node scripts/import-room-monthly-costs.ts <xlsx-path>');
    process.exitCode = 1;
  } else {
    importRoomMonthlyCosts(workbookPath)
      .then((result) => console.log(JSON.stringify(result, null, 2)))
      .catch((error) => {
        console.error(error);
        process.exitCode = 1;
      })
      .finally(() => prisma.$disconnect());
  }
}

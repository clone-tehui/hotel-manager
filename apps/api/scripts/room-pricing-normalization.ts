const ROOM_CODE_ALIASES = new Map<string, string>([
  ['C05.03', 'C05.03A'],
]);

export function normalizeRoomCodeSegments(value: string): string {
  const normalized = String(value || '').trim().toUpperCase();
  const match = normalized.match(/^([A-Z]+)(\d+)([A-Z]?)(?:\.(\d+)([A-Z]?))?$/);
  if (!match) return normalized;
  const [, prefix, leftDigits, leftSuffix = '', rightDigits = '', rightSuffix = ''] = match;
  const left = leftDigits.padStart(2, '0');
  if (!rightDigits) return `${prefix}${left}${leftSuffix}`;
  const right = rightDigits.padStart(2, '0');
  return `${prefix}${left}${leftSuffix}.${right}${rightSuffix}`;
}

export function normalizeImportedRoomCode(raw: string): string {
  const normalized = String(raw || '')
    .trim()
    .replace(/^The\s+/i, '')
    .replace(/^Opera\s+/i, '')
    .replace(/^Galleria\s+/i, '')
    .replace(/^Crest\s+/i, '')
    .replace(/^Lancaster\s+/i, '')
    .replace(/^Vin\s+/i, '')
    .replace(/\bDuplex\b/gi, '')
    .replace(/\b\d+m2\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
  const canonical = normalizeRoomCodeSegments(normalized);
  return ROOM_CODE_ALIASES.get(canonical) || canonical;
}

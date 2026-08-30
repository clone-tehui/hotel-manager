import * as assert from 'node:assert/strict';
import { normalizeImportedRoomCode } from './room-pricing-normalization';

const cases: Array<[string, string]> = [
  ['C05.03', 'C05.03A'],
  ['Galleria C05.03 50m2', 'C05.03A'],
  ['C3.12', 'C03.12'],
  ['B18.3', 'B18.03'],
  ['A3.12B', 'A03.12B'],
];

for (const [input, expected] of cases) {
  assert.equal(normalizeImportedRoomCode(input), expected, `normalizeImportedRoomCode(${input})`);
}

console.log(JSON.stringify({ ok: true, cases: cases.length }, null, 2));

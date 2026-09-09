import { test } from 'node:test';
import * as assert from 'node:assert/strict';

function normalize(raw:any) {
  if (raw && !Array.isArray(raw.roomStrategies) && raw.roomStrategies && typeof raw.roomStrategies === 'object') {
    const candidate = raw.roomStrategies;
    const values = Object.values(candidate);
    if (typeof candidate.roomId === 'string' && typeof candidate.periodKey === 'string') raw.roomStrategies = [candidate];
    else if (values.length && values.every((value) => value && typeof value === 'object')) raw.roomStrategies = values;
  }
  return raw;
}

test('normalizes a singleton roomStrategies object losslessly', () => {
  const strategy = { roomId: 'r1', periodKey: 'thisWeek' };
  assert.deepEqual(normalize({ roomStrategies: strategy }).roomStrategies, [strategy]);
});

test('normalizes room-id-keyed roomStrategies map', () => {
  const a = { roomId: 'r1' }, b = { roomId: 'r2' };
  assert.deepEqual(normalize({ roomStrategies: { r1: a, r2: b } }).roomStrategies, [a,b]);
});

import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateMemoryControl } from './memory-policy';

test('typed memory controls fail closed for invalid confidence, status, expiry and invalidation without reason', () => {
  for (const input of [{ confidence: 101 }, { confidence: 2.5 }, { status: 'DELETED' }, { expiresAt: 'not-a-date' }, { status: 'INVALIDATED' }]) assert.throws(() => validateMemoryControl(input as any));
  assert.doesNotThrow(() => validateMemoryControl({ confidence: 80, status: 'INVALIDATED', invalidationReason: 'superseded by measured outcome', expiresAt: null }));
});

test('typed memory controls allow a safe lifecycle restoration after a temporary disable', () => {
  assert.doesNotThrow(() => validateMemoryControl({ status: 'DISABLED' }));
  assert.doesNotThrow(() => validateMemoryControl({ status: 'ACTIVE' }));
});

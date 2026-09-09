import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { batchError, retryDisposition, shouldRecoverRun } from './recovery-policy';

const now = new Date('2026-09-01T08:00:00.000Z');

test('recovers only stale active runs, not terminal or recently heartbeating runs', () => {
  assert.equal(shouldRecoverRun({ id: 'a', status: 'ANALYZING', startedAt: new Date('2026-09-01T07:55:00.000Z'), heartbeatAt: new Date('2026-09-01T07:58:29.000Z') }, now), true);
  assert.equal(shouldRecoverRun({ id: 'b', status: 'ANALYZING', startedAt: new Date('2026-09-01T07:55:00.000Z'), heartbeatAt: new Date('2026-09-01T07:58:31.000Z') }, now), false);
  assert.equal(shouldRecoverRun({ id: 'c', status: 'COMPLETED', startedAt: new Date('2026-09-01T07:00:00.000Z') }, now), false);
});

test('allows two retries and then fails bounded recovery', () => {
  assert.equal(retryDisposition(0), 'REQUEUE');
  assert.equal(retryDisposition(1), 'REQUEUE');
  assert.equal(retryDisposition(2), 'FAIL');
  assert.throws(() => retryDisposition(-1));
  assert.equal(batchError('RETRY_EXHAUSTED', 'provider timed out'), 'RETRY_EXHAUSTED: provider timed out');
});

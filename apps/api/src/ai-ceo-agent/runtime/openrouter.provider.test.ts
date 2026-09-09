import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { OPENROUTER_REQUEST_TIMEOUT_MS, CONTROLLED_PROVIDER_TIMEOUT_MS, providerTimeoutMs } from './openrouter.provider';
import { ASYNC_RUN_STALE_AFTER_MS } from './recovery-policy';

test('provider request ceiling stays below stale recovery threshold', () => {
  assert.ok(OPENROUTER_REQUEST_TIMEOUT_MS < ASYNC_RUN_STALE_AFTER_MS);
  assert.equal(OPENROUTER_REQUEST_TIMEOUT_MS, 75_000);
  assert.equal(providerTimeoutMs('https://openrouter.ai/api/v1/chat/completions', 600_000), 75_000);
  assert.equal(providerTimeoutMs('https://127.0.0.1:1/controlled-test', 600_000), CONTROLLED_PROVIDER_TIMEOUT_MS);
});

import { strict as assert } from 'assert';
import { isProviderCircuitOpen } from './recovery-policy';
assert.equal(isProviderCircuitOpen(new Error('AI provider circuit breaker is open; retry after cooldown')), true);
assert.equal(isProviderCircuitOpen(new Error('provider socket timeout')), false);
assert.equal(/^https:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\//i.test('https://127.0.0.1:1/controlled-no-provider'), true);
assert.equal(/^https:\/\/(127\.0\.0\.1|localhost)(?::\d+)?\//i.test('https://openrouter.ai/api/v1/chat/completions'), false);
console.log('circuit policy tests passed');

import * as assert from 'assert';
import { assertSafeCredentialShape, normalizeOtaChannel } from './ota-connector.policy';
assert.equal(normalizeOtaChannel('airbnb'), 'AIRBNB');
assert.throws(() => normalizeOtaChannel('booking'), /chưa được hỗ trợ/);
assert.deepEqual(assertSafeCredentialShape({ clientId: 'demo', clientSecret: 'placeholder' }), { clientId: 'demo', clientSecret: 'placeholder' });
assert.throws(() => assertSafeCredentialShape({ clientId: '' }), /không hợp lệ/);
assert.throws(() => assertSafeCredentialShape({ 'bad-key': 'x' }), /không hợp lệ/);
console.log('ota-connector-policy-pass');

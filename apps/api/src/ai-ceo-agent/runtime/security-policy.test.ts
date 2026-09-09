import { strict as assert } from 'assert';
import { ToolRegistry } from '../tools/tool-registry';
const registry = new ToolRegistry();
registry.register({ definition: { type: 'function', function: { name: 'blocked_write', description: 'test', strict: true, parameters: { type: 'object', properties: {}, additionalProperties: false } } }, readOnly: false, timeoutMs: 1000, authorize: () => true, validate: () => ({}), execute: async () => ({ ok: true, data: {}, meta: {} }) } as any);
(async () => { await assert.rejects(() => registry.execute('blocked_write', {}, { runId: 'r', role: 'ADMIN' } as any), /Write tool is disabled/); await assert.rejects(() => registry.execute('missing', {}, { runId: 'r', role: 'ADMIN' } as any), /Unknown AI tool/); console.log('security policy tests passed'); })().catch(e => { console.error(e); process.exit(1); });

import { strict as assert } from 'assert';
import { BatchAnalysisService } from './batch-analysis.service';

const values = new Map<string, string>([
  ['ai_ceo_provider_circuit', '{"failures":0}'],
  ['ai_ceo_run_controls', '{"failureThreshold":1,"cooldownMs":60000}'],
  ['ai_ceo…oint', 'https://127.0.0.1:1/controlled-test'],
]);
const writes: any[] = [];
const prisma: any = { systemSetting: {
  findUnique: async ({ where }: any) => values.has(where.key) ? { value: values.get(where.key) } : null,
  upsert: async (input: any) => { const value = input.update.value; values.set(input.where.key, value); writes.push({ key: input.where.key, value }); return { key: input.where.key, value }; },
}};
const config: any = { get: (key: string) => key === 'OPENROUTER_API_KEY' ? 'test-key' : undefined };
const svc = new BatchAnalysisService(prisma, config, {} as any, {} as any);
const snapshot = { periods: [{ key: 'thisWeek', from: '2026-09-01', to: '2026-09-07' }], rows: [] };
(async () => {
  await assert.rejects(() => svc.analyze({ runId: 'r', batchId: 'b', batchSequence: 1, roomIds: ['room'], periodKeys: ['thisWeek'], model: 'test', snapshot }), /controlled local provider endpoint rejected/);
  const state = JSON.parse(values.get('ai_ceo_provider_circuit')!);
  assert.equal(state.failures, 1);
  assert.ok(state.openedUntil > Date.now());
  assert.equal(writes.length, 1);
  console.log('batch circuit integration passed', state);
})().catch(error => { console.error(error); process.exit(1); });

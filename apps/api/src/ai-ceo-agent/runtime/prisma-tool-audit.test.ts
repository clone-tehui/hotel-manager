import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { sanitizeToolAudit, toPrismaJson } from './prisma-tool-audit';

test('tool audit redacts secrets, preserves business evidence, and makes JSON-safe numbers', () => {
  assert.deepEqual(sanitizeToolAudit({ roomId: 'r1', apiKey: 'secret', nested: { authorization: 'Bearer x', revenue: 12, pctChange: Number.NaN }, ratio: Infinity }), {
    roomId: 'r1', apiKey: '[REDACTED]', nested: { authorization: '[REDACTED]', revenue: 12, pctChange: null }, ratio: null,
  });
});

class DecimalLike { constructor(private value:string){} toJSON(){return this.value;} }
test('tool audit converts custom-prototype dashboard values to plain Prisma JSON',()=>{
 const output:any=toPrismaJson({data:{revenue:{current:new DecimalLike('6354630414')},generatedAt:new Date('2026-08-31T00:00:00Z')},meta:{durationMs:12}});
 assert.deepEqual(output,{data:{revenue:{current:'6354630414'},generatedAt:'2026-08-31T00:00:00.000Z'},meta:{durationMs:12}});
 assert.equal(Object.getPrototypeOf(output.data),Object.prototype);
});

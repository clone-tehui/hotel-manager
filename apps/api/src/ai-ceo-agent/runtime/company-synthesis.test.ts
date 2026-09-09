import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { synthesizeCompanyReport } from './company-synthesis';

test('ranks only validated strategies and preserves approval-only safety', () => {
  const report = synthesizeCompanyReport([
    { roomId: 'b', periodKey: 'thisWeek', priority: 'LOW', assessment: 'a', objective: 'o', evidence: ['e'], dataReferences: ['occupancy'] },
    { roomId: 'a', periodKey: 'thisWeek', priority: 'CRITICAL', assessment: 'a', objective: 'o', evidence: ['e'], dataReferences: ['occupancy'] },
  ]);
  assert.equal(report.generatedFromStrategies, 2);
  assert.deepEqual(report.rankedActions.map((item) => item.roomId), ['a', 'b']);
  assert.equal(report.conflictChecks.duplicateRoomPeriod, false);
  assert.equal(report.safety.externalActionsExecuted, false);
  assert.ok(report.rankedActions.every((item) => item.requiresApproval));
});

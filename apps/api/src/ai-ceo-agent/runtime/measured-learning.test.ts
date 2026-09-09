import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { buildMeasuredCampaignLesson } from './measured-learning';

const campaign = {
  id: 'campaign-1', runId: 'run-1', roomId: 'room-1', roomNumber: 'A01', periodKey: 'thisWeek', objective: 'Test',
  measurementStatus: 'MEASURED', measurementOutcome: 'IMPROVED', measuredAt: new Date('2026-01-04T00:00:00Z'),
  measurementSource: { system: 'dashboard-report' },
  reviewResult: { status: 'MEASURED', deltas: { revenue: 100, bookedNights: 1 }, confounders: ['No causal attribution is claimed.'] },
};

test('creates a typed traceable lesson only from persisted measured outcome', () => {
  const lesson = buildMeasuredCampaignLesson(campaign);
  assert.ok(lesson);
  assert.equal(lesson?.provenance.kind, 'LESSON');
  assert.equal(lesson?.provenance.sourceCampaignId, 'campaign-1');
  assert.equal(lesson?.content.outcome, 'IMPROVED');
  assert.equal(lesson?.content.advisoryOnly, true);
});

test('rejects unmeasured, insufficient, or incomplete measurement records', () => {
  assert.equal(buildMeasuredCampaignLesson({ ...campaign, measurementStatus: null }), null);
  assert.equal(buildMeasuredCampaignLesson({ ...campaign, measurementOutcome: 'INSUFFICIENT_DATA' }), null);
  assert.equal(buildMeasuredCampaignLesson({ ...campaign, reviewResult: { status: 'MEASURED', deltas: { revenue: null } } }), null);
});

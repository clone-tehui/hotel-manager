import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { validateCampaignTransition } from './campaign-lifecycle';

test('campaign lifecycle allows only explicit forward transitions', () => {
  assert.deepEqual(validateCampaignTransition('PROPOSED', 'APPROVED', 'reviewed verified campaign proposal'), { idempotent: false });
  assert.deepEqual(validateCampaignTransition('APPROVED', 'RUNNING'), { idempotent: false });
  assert.deepEqual(validateCampaignTransition('RUNNING', 'REVIEW_DUE'), { idempotent: false });
  assert.deepEqual(validateCampaignTransition('REVIEW_DUE', 'COMPLETED'), { idempotent: false });
  assert.throws(() => validateCampaignTransition('PROPOSED', 'COMPLETED'));
  assert.throws(() => validateCampaignTransition('COMPLETED', 'RUNNING'));
});

test('campaign lifecycle is idempotent and requires a reason for rejection/cancellation', () => {
  assert.deepEqual(validateCampaignTransition('PROPOSED', 'PROPOSED'), { idempotent: true });
  assert.throws(() => validateCampaignTransition('PROPOSED', 'APPROVED'));
  assert.throws(() => validateCampaignTransition('PROPOSED', 'REJECTED'));
  assert.deepEqual(validateCampaignTransition('PROPOSED', 'REJECTED', 'manager rejected strategy'), { idempotent: false });
  assert.throws(() => validateCampaignTransition('RUNNING', 'CANCELLED'));
  assert.deepEqual(validateCampaignTransition('RUNNING', 'CANCELLED', 'inventory exception'), { idempotent: false });
});

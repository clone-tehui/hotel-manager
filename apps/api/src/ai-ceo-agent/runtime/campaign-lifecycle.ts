export const CAMPAIGN_STATUSES = ['PROPOSED', 'APPROVED', 'REJECTED', 'RUNNING', 'REVIEW_DUE', 'COMPLETED', 'CANCELLED'] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];

const LEGAL_TRANSITIONS: Record<CampaignStatus, readonly CampaignStatus[]> = {
  PROPOSED: ['APPROVED', 'REJECTED', 'CANCELLED'],
  APPROVED: ['RUNNING', 'CANCELLED'],
  REJECTED: [],
  RUNNING: ['REVIEW_DUE', 'CANCELLED'],
  REVIEW_DUE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
};

export function validateCampaignTransition(fromStatus: string, toStatus: string, reason?: string) {
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(fromStatus)) throw new Error('invalid current campaign status');
  if (!(CAMPAIGN_STATUSES as readonly string[]).includes(toStatus)) throw new Error('invalid target campaign status');
  if (fromStatus === toStatus) return { idempotent: true };
  if (!(LEGAL_TRANSITIONS[fromStatus as CampaignStatus] as readonly string[]).includes(toStatus)) throw new Error(`illegal campaign transition: ${fromStatus} -> ${toStatus}`);
  if ((toStatus === 'APPROVED' || toStatus === 'REJECTED' || toStatus === 'CANCELLED') && !reason?.trim()) throw new Error('transition reason is required');
  return { idempotent: false };
}
